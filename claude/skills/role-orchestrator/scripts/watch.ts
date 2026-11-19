// Reports worker, pull request, and hand-launch transitions as they happen,
// reading only. A crashed worker vanishes from the roster, which a watch on
// pull requests alone misses. A failed read never ends the hours-long loop.
import { baseBranch, baseRef, gitPath, mainRoot, run } from './repo'

// Seconds between passes. A pass costs two cheap reads and the transitions it
// watches take minutes, so the number trades staleness against little. Raise it
// in a project whose workers run long.
const INTERVAL_S = 60

// "waiting" never resolves on its own, unlike "busy" and "idle". The number sits
// well above INTERVAL_S, so several passes confirm a row, and well inside the
// ten-to-thirty-minute span a dispatched build ordinarily runs.
export const STALL_THRESHOLD_S = 300

export type Read<T> = { isOk: false } | { isOk: true; value: T }

export interface Worker {
  branch: string
  dwellMs: number
  id: string
  name: string
  status: string
}

/** A worker row the hand-launch queue holds, by the branch its plan derives. */
export interface QueuedWorker {
  branch: string
  label: string
}

export interface WatchState {
  /** Queued rows already reported launched, so a launch prints once. */
  launched: ReadonlySet<string>
  /** Names currently reported as stalled, so a stall prints once. */
  stalled: ReadonlySet<string>
  /** Null until a read succeeds, so each source keeps its own baseline flag. */
  pulls: null | readonly string[]
  workers: null | readonly Worker[]
}

export const initialState = (): WatchState => ({
  launched: new Set(),
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

const launchKey = (queued: QueuedWorker): string =>
  `${queued.label}\t${queued.branch}`

// A key leaves the set once its row leaves the queue, so a row queued again
// after a failed launch reports its next launch too.
const launchLines = (
  queue: readonly QueuedWorker[],
  workers: readonly Worker[],
  previous: ReadonlySet<string>,
): { launched: Set<string>; lines: string[] } => {
  const launched = new Set<string>()
  const lines: string[] = []

  const ordered = [...queue].sort((a, b) => byBytes(launchKey(a), launchKey(b)))
  for (const queued of ordered) {
    const key = launchKey(queued)
    if (previous.has(key)) {
      launched.add(key)
      continue
    }

    const holder = workers.find((worker) => worker.branch === queued.branch)
    if (holder === undefined) continue

    lines.push(`LAUNCHED ${queued.label} -> ${holder.name} [${holder.id}]`)
    launched.add(key)
  }

  return { launched, lines }
}

/**
 * One pass over three reads. A failed read is reported and the previous baseline
 * kept, since reading an empty result as the current state would report every
 * worker gone and every pull request new on the pass after.
 */
export const pass = (
  state: WatchState,
  pulls: Read<string[]>,
  workers: Read<Worker[]>,
  queue: Read<QueuedWorker[]> = { isOk: true, value: [] },
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
  if (!queue.isOk) {
    lines.push(
      'watch: the dispatch queue failed to load, so no hand launch is matched this pass',
    )
  }

  if (pulls.isOk && state.pulls !== null) {
    lines.push(
      ...unseen(pulls.value, state.pulls, (line) => line).sort(byBytes),
    )
  }

  let launched = state.launched
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

    if (queue.isOk && queue.value.length === 0) {
      launched = new Set()
    } else if (queue.isOk) {
      const launches = launchLines(queue.value, sorted, launched)
      lines.push(...launches.lines)
      launched = launches.launched
    }
  }

  return {
    lines,
    state: {
      launched,
      pulls: pulls.isOk ? pulls.value : state.pulls,
      stalled,
      workers: workers.isOk ? workers.value : state.workers,
    },
  }
}

const readPulls = (): Read<string[]> => {
  const listed = run('gh', [
    'api',
    '--paginate',
    'repos/{owner}/{repo}/pulls?state=open&per_page=100',
    '--jq',
    '.[] | "PR-OPEN #\\(.number) \\(.head.ref) \\(.title)"',
  ])
  if (!listed.isOk) return { isOk: false }

  return {
    isOk: true,
    value: listed.stdout.split('\n').filter((l) => l !== ''),
  }
}

const asText = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback

// Every session holding a non-base branch is a worker, since an `orchestrator-`
// prefix match misses every hand-launched one. The name stays whole, since one
// this client writes carries spaces.
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
      id: asText(row.sessionId, ''),
      name: asText(row.name, ''),
      status: asText(row.status, ''),
    })
  }

  return { isOk: true, value: workers }
}

/**
 * The worker rows the hand-launch queue holds. Planner and reviewer rows stay
 * on the operator's word, since neither takes a branch of its own.
 */
export const parseQueue = (stdout: string): Read<QueuedWorker[]> => {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout.trimEnd().split('\n').at(-1) ?? '')
  } catch {
    return { isOk: false }
  }

  const prompts =
    typeof parsed === 'object' &&
    parsed !== null &&
    Array.isArray((parsed as { prompts?: unknown }).prompts)
      ? (parsed as { prompts: unknown[] }).prompts
      : null
  if (prompts === null) return { isOk: false }

  const queued: QueuedWorker[] = []
  for (const prompt of prompts) {
    if (typeof prompt !== 'object' || prompt === null) continue
    const row = prompt as Record<string, unknown>
    if (row.role !== 'worker' || typeof row.branch !== 'string') continue
    queued.push({ branch: row.branch, label: asText(row.label, '') })
  }

  return { isOk: true, value: queued }
}

const readQueue = (): Read<QueuedWorker[]> => {
  const listed = run('canon', ['dispatch', 'prompts', 'list', '--json'])

  return listed.isOk ? parseQueue(listed.stdout) : { isOk: false }
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
    const result = pass(
      state,
      readPulls(),
      readWorkers(repository, base),
      readQueue(),
    )
    for (const line of result.lines) console.log(line)
    state = result.state
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_S * 1000))
  }
}

if (import.meta.main) process.exitCode = await main()
