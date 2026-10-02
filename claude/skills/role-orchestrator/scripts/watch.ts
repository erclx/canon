// Reports worker and pull request transitions as they happen. Reads only.
//
// The poll answers "what moved since the last run" on a schedule the session
// holds. This answers "what just changed" on a loop of its own, and it exists
// because the two readings a dispatch needs are not one reading: a worker that
// finishes goes idle and a worker that crashes vanishes, so a watch matching
// only the pull request list stays silent through the second. A third case is
// neither: a worker that stops on a question or a prompt neither finishes nor
// crashes, and sits reading "waiting" until something reports it, which is the
// WORKER-STOPPED line below, or WORKER-UNMEASURABLE for a "waiting" row too old
// to carry a stamp this reads.
//
// Run as `bun watch.ts`. A failed read never ends the loop, since it runs for
// hours and one transient `gh` failure aborting it is a silent stop. Every read
// states its own failure instead.
import { baseBranch, baseRef, gitPath, mainRoot, run } from './repo'

// Seconds between passes. A pass costs two cheap reads and the transitions it
// watches take minutes, so the number trades staleness against little. Raise it
// in a project whose workers run long.
const INTERVAL_S = 60

// Seconds a worker can sit in "waiting" before this reports it as stopped
// rather than folding it into the ordinary status-change lines. "busy" and
// "idle" resolve on their own; "waiting" does not, so a dwell that keeps
// growing there is a session blocked on something outside itself. The number
// sits well above INTERVAL_S, so a handful of passes confirm the row before it
// reports, and well inside the ten-to-thirty-minute span a dispatched build
// ordinarily runs. A permission prompt clears the moment a person approves it
// and a question can sit legitimately, and one number serves both.
export const STALL_THRESHOLD_S = 300

export type Read<T> = { isOk: false } | { isOk: true; value: T }

export interface Worker {
  branch: string
  dwellMs: number
  name: string
  status: string
}

export interface WatchState {
  /** Names currently reported as stalled, so a stall prints once. */
  stalled: ReadonlySet<string>
  /** Null until a read succeeds, so each source keeps its own baseline flag. */
  pulls: null | readonly string[]
  workers: null | readonly Worker[]
}

export const initialState = (): WatchState => ({
  pulls: null,
  stalled: new Set(),
  workers: null,
})

// `sort` orders by byte, so a title with a non-ASCII first character prints in
// the order it always did rather than in UTF-16 code unit order.
const byBytes = (a: string, b: string): number =>
  Buffer.compare(Buffer.from(a), Buffer.from(b))

const rowOf = (worker: Worker): string =>
  [worker.name, worker.branch, worker.status, String(worker.dwellMs)].join('\t')

// Identity leaves the dwell out. It grows every second, so keying on it
// reported every worker as new on every pass.
const identityOf = (worker: Worker): string =>
  JSON.stringify([worker.name, worker.branch, worker.status])

const unseen = <T>(
  current: readonly T[],
  previous: readonly T[],
  key: (item: T) => string,
): T[] => {
  const known = new Set(previous.map(key))

  return current.filter((item) => !known.has(key(item)))
}

const stallLines = (
  workers: readonly Worker[],
  previous: ReadonlySet<string>,
  thresholdS: number,
): { lines: string[]; stalled: Set<string> } => {
  const stalled = new Set(previous)
  const lines: string[] = []

  for (const worker of workers) {
    if (worker.name === '') continue

    if (worker.status !== 'waiting') {
      stalled.delete(worker.name)
      continue
    }

    if (worker.dwellMs === -1) {
      if (!stalled.has(worker.name)) {
        lines.push(`WORKER-UNMEASURABLE ${worker.name} ${worker.branch}`)
        stalled.add(worker.name)
      }
      continue
    }

    const dwellS = Math.trunc(worker.dwellMs / 1000)
    if (dwellS < thresholdS) {
      stalled.delete(worker.name)
    } else if (!stalled.has(worker.name)) {
      lines.push(`WORKER-STOPPED ${worker.name} ${worker.branch} ${dwellS}s`)
      stalled.add(worker.name)
    }
  }

  return { lines, stalled }
}

/**
 * One pass over two reads. A failed read is reported and the previous baseline
 * kept, since reading an empty result as the current state would report every
 * worker gone and every pull request new on the pass after.
 */
export const pass = (
  state: WatchState,
  pulls: Read<string[]>,
  workers: Read<Worker[]>,
  thresholdS = STALL_THRESHOLD_S,
): { lines: string[]; state: WatchState } => {
  const lines: string[] = []

  if (!pulls.isOk) {
    lines.push(
      'watch: the open pull request list failed to load, so none is classified this pass',
    )
  }
  if (!workers.isOk) {
    lines.push(
      'watch: the session roster failed to load, so no worker is classified this pass',
    )
  }

  if (pulls.isOk && state.pulls !== null) {
    lines.push(
      ...unseen(pulls.value, state.pulls, (line) => line).sort(byBytes),
    )
  }

  let stalled = state.stalled
  if (workers.isOk) {
    const sorted = [...workers.value].sort((a, b) =>
      byBytes(rowOf(a), rowOf(b)),
    )
    if (state.workers !== null) {
      const changed = unseen(sorted, state.workers, identityOf)
      lines.push(...changed.map((worker) => `WORKER ${rowOf(worker)}`))

      const names = new Set(sorted.map((worker) => worker.name))
      const gone = [...new Set(state.workers.map((worker) => worker.name))]
        .filter((name) => !names.has(name))
        .sort(byBytes)
      lines.push(...gone.map((name) => `WORKER-GONE ${name}`))
    }

    const stalls = stallLines(sorted, stalled, thresholdS)
    lines.push(...stalls.lines)
    stalled = stalls.stalled
  }

  return {
    lines,
    state: {
      pulls: pulls.isOk ? pulls.value : state.pulls,
      stalled,
      workers: workers.isOk ? workers.value : state.workers,
    },
  }
}

const readPulls = (): Read<string[]> => {
  const listed = run('gh', [
    'pr',
    'list',
    '--state',
    'open',
    '--json',
    'number,headRefName,title',
    '--jq',
    '.[] | "PR-OPEN #\\(.number) \\(.headRefName) \\(.title)"',
  ])
  if (!listed.isOk) return { isOk: false }

  return {
    isOk: true,
    value: listed.stdout.split('\n').filter((l) => l !== ''),
  }
}

const asText = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback

/**
 * Every session in this repository holding a branch other than the base one is
 * a worker, whoever launched it. A match on the `orchestrator-` name prefix
 * reads a dispatched worker and misses every hand-launched one. The name stays whole, since one
 * this client writes carries spaces.
 */
const readWorkers = (repository: string, base: string): Read<Worker[]> => {
  const listed = run('canon', ['sessions', 'list', '--json'])
  if (!listed.isOk) return { isOk: false }

  const last = listed.stdout.trimEnd().split('\n').at(-1) ?? ''
  let parsed: unknown
  try {
    parsed = JSON.parse(last)
  } catch {
    return { isOk: false }
  }

  const sessions =
    typeof parsed === 'object' &&
    parsed !== null &&
    Array.isArray((parsed as { sessions?: unknown }).sessions)
      ? (parsed as { sessions: unknown[] }).sessions
      : []

  const workers: Worker[] = []
  for (const session of sessions) {
    if (typeof session !== 'object' || session === null) continue
    const row = session as Record<string, unknown>
    if (row.repository !== repository) continue
    if (
      row.branch === null ||
      row.branch === undefined ||
      row.branch === base
    ) {
      continue
    }

    workers.push({
      branch: asText(row.branch, ''),
      dwellMs: typeof row.statusDwellMs === 'number' ? row.statusDwellMs : -1,
      name: asText(row.name, ''),
      status: asText(row.status, ''),
    })
  }

  return { isOk: true, value: workers }
}

const main = async (): Promise<number> => {
  const root = mainRoot()
  if (root === null) {
    console.error('watch: not a git repository, so nothing is watched')

    return 1
  }

  const repository = gitPath(root)
  const base = baseBranch(baseRef())
  let state = initialState()

  for (;;) {
    const result = pass(state, readPulls(), readWorkers(repository, base))
    for (const line of result.lines) console.log(line)
    state = result.state
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_S * 1000))
  }
}

if (import.meta.main) process.exitCode = await main()
