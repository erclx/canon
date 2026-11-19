import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ResolvedSession } from '@/sessions/resolve'
import type { StopReading } from '@/sessions/stop'
import {
  archiveDir,
  declinedDir,
  isReservedStem,
  readSessions,
  type SessionEntry,
  tasksDir,
} from '@/tasks/archive'

/**
 * Where a task file sits. `live` is still on the board, and `archived` and
 * `declined` are settled, so a session named only on settled tasks owes them
 * nothing.
 */
export type TaskState = 'live' | 'archived' | 'declined'

export interface TaskSessions {
  readonly stem: string
  readonly state: TaskState
  readonly entries: readonly SessionEntry[]
}

export type SkipReason =
  | 'caller'
  | 'kept'
  | 'controller'
  | 'interactive'
  | 'talk'
  | 'busy'
  | 'usage-limit'
  | 'open-task'
  | 'recent'

export type ReapOutcome =
  | 'stopped'
  | 'removed'
  | 'would-stop'
  | 'would-remove'
  | 'skipped'
  | 'gone'
  | 'failed'

export interface ReapRow {
  readonly sessionId: string
  readonly name: string
  readonly outcome: ReapOutcome
  readonly reason: SkipReason | null
  /** The status, the open task, the dwell, or the client's output on a failure. */
  readonly detail: string | null
  /**
   * The id the client lists the session under, which the reap passed it or
   * would pass on a dry run. Null where the client listed none, and absent
   * on a row the reap never acted on.
   */
  readonly clientId?: string | null
}

export type RosterRow = ResolvedSession & Pick<StopReading, 'stopped'>

/**
 * `waiting` is the ordinary status of a background session that reported and
 * ended its turn, so it reads as finished beside `idle`. Every other status,
 * `busy` among them, has a turn still running.
 */
const IDLE_STATUSES: readonly string[] = ['idle', 'waiting']

/**
 * `shell` is a turn ended with a background command still held, such as a
 * worker's preview server or a review wait. It reads as finished only once the
 * work is settled, being a task archived or declined, since on a live task the
 * command is usually a check the session is still waiting on.
 */
const SETTLED_STATUSES: readonly string[] = [...IDLE_STATUSES, 'shell']

const TALK_MARKER = '-talk'

/** The roster name every orchestrator launch carries, the controller of its wave. */
const CONTROLLER_PREFIX = 'orchestrator'

export interface ReapGuards {
  /** The caller's own sessionId, or null where the environment names none. */
  readonly self: string | null
  /** Sessions the caller keeps, such as a planner held for reuse. */
  readonly keep: readonly string[]
}

interface Candidate {
  readonly sessionId: string
  readonly name: string
}

/**
 * The skip every form shares. Order matters only for which reason a row
 * reads, so the reasons that protect a person's or a controller's session come
 * ahead of the ones about the work.
 */
function sharedSkip(
  row: RosterRow,
  guards: ReapGuards,
  tasks: readonly TaskSessions[],
  exclude: string | null,
  finished: readonly string[],
): Pick<ReapRow, 'reason' | 'detail'> | null {
  const id = row.sessionId ?? ''
  if (id === guards.self) return { reason: 'caller', detail: null }
  if (guards.keep.includes(id)) return { reason: 'kept', detail: null }
  if (row.kind !== 'bg') return { reason: 'interactive', detail: row.kind }
  if (row.name.startsWith(CONTROLLER_PREFIX)) {
    return { reason: 'controller', detail: row.name }
  }
  if (row.name.includes(TALK_MARKER)) return { reason: 'talk', detail: null }
  if (!finished.includes(row.status)) {
    return { reason: 'busy', detail: row.status }
  }
  if (row.stopped === 'usage-limit') {
    return { reason: 'usage-limit', detail: null }
  }

  const open = tasks.find(
    (task) =>
      task.state === 'live' &&
      task.stem !== exclude &&
      task.entries.some((entry) => entry.sessionId === id),
  )
  if (open) return { reason: 'open-task', detail: open.stem }

  return null
}

export interface ReapPlan {
  /** Rows decided without running anything: skipped and gone. */
  readonly settled: readonly ReapRow[]
  /** Sessions the reap acts on, in the order the task or roster listed them. */
  readonly targets: readonly Candidate[]
}

/**
 * The task form: every session the named task records, matched to the roster
 * by its full sessionId alone, so no name or prefix ever selects one.
 */
export function planTaskReap(
  task: TaskSessions,
  roster: readonly RosterRow[],
  tasks: readonly TaskSessions[],
  guards: ReapGuards,
): ReapPlan {
  const settled: ReapRow[] = []
  const targets: Candidate[] = []

  for (const entry of task.entries) {
    const row = roster.find((session) => session.sessionId === entry.sessionId)
    if (row === undefined) {
      settled.push({
        sessionId: entry.sessionId,
        name: entry.name,
        outcome: 'gone',
        reason: null,
        detail: null,
      })
      continue
    }

    const skip = sharedSkip(
      row,
      guards,
      tasks,
      task.stem,
      task.state === 'live' ? IDLE_STATUSES : SETTLED_STATUSES,
    )
    if (skip) {
      settled.push({
        sessionId: entry.sessionId,
        name: row.name,
        outcome: 'skipped',
        ...skip,
      })
      continue
    }

    targets.push({ sessionId: entry.sessionId, name: row.name })
  }

  return { settled, targets }
}

/**
 * The finished form: every background session in one repository whose work is
 * over, being one recorded on settled tasks alone, or one no task records that
 * has sat idle past the threshold. Status alone never says done, so a session
 * with no task and no measured dwell is left alone.
 */
export function planFinishedReap(
  roster: readonly RosterRow[],
  tasks: readonly TaskSessions[],
  guards: ReapGuards,
  repository: string,
  idleMs: number,
): ReapPlan {
  const settled: ReapRow[] = []
  const targets: Candidate[] = []

  for (const row of roster) {
    if (row.repository !== repository || row.sessionId === null) continue
    if (row.kind !== 'bg') continue

    const id = row.sessionId
    const recorded = tasks.some((task) =>
      task.entries.some((entry) => entry.sessionId === id),
    )
    const skip = sharedSkip(
      row,
      guards,
      tasks,
      null,
      recorded ? SETTLED_STATUSES : IDLE_STATUSES,
    )
    if (skip) {
      settled.push({
        sessionId: id,
        name: row.name,
        outcome: 'skipped',
        ...skip,
      })
      continue
    }

    if (
      !recorded &&
      (row.statusDwellMs === null || row.statusDwellMs < idleMs)
    ) {
      settled.push({
        sessionId: id,
        name: row.name,
        outcome: 'skipped',
        reason: 'recent',
        detail:
          row.statusDwellMs === null
            ? 'unmeasured'
            : `${Math.round(row.statusDwellMs / 60_000)}m`,
      })
      continue
    }

    targets.push({ sessionId: id, name: row.name })
  }

  return { settled, targets }
}

export interface ClientResult {
  readonly exitCode: number
  readonly output: string
}

/**
 * Each sessionId the client lists, mapped to the id its `stop` and `rm` take,
 * or undefined when the listing could not be read.
 */
export type ClientIds = ReadonlyMap<string, string> | undefined

export interface ReapEffects {
  /** Runs `claude stop <id>` or `claude rm <id>` with the client's own id. */
  readonly run: (verb: 'stop' | 'rm', id: string) => Promise<ClientResult>
  /** The client's listing, read fresh, which names the id its verbs take. */
  readonly clientIds: () => Promise<ClientIds>
  /** The sessionIds still live on the roster, read fresh. */
  readonly live: () => Promise<ReadonlySet<string>>
  /** Waits between roster reads while a stopped process exits. */
  readonly pause: (ms: number) => Promise<void>
}

const SETTLE_READS = 6
const SETTLE_PAUSE_MS = 500

/**
 * Reads `claude agents --json` into the sessionId-to-client-id map. The client
 * lists a background session under a short `id` beside its full `sessionId`,
 * and its `stop` and `rm` match the short one alone. Anything but an array of
 * rows reads as unreadable, never as an empty listing.
 */
export function parseClientIds(text: string): ClientIds {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!Array.isArray(parsed)) return undefined
  const ids = new Map<string, string>()
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue
    const { id, sessionId } = entry as Record<string, unknown>
    if (typeof id === 'string' && typeof sessionId === 'string') {
      ids.set(sessionId, id)
    }
  }
  return ids
}

async function spawnClient(
  binary: string,
  args: readonly string[],
): Promise<ClientResult & { readonly stdout: string }> {
  try {
    const proc = Bun.spawn([binary, ...args], {
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    return { exitCode, output: `${stdout}${stderr}`, stdout }
  } catch (error) {
    return { exitCode: 127, output: String(error), stdout: '' }
  }
}

/** The two effects that reach the client binary, found on `PATH` by name. */
export function clientEffects(
  binary = 'claude',
): Pick<ReapEffects, 'run' | 'clientIds'> {
  return {
    run: async (verb, id) => {
      const { exitCode, output } = await spawnClient(binary, [verb, id])
      return { exitCode, output }
    },
    clientIds: async () => {
      const result = await spawnClient(binary, ['agents', '--json'])
      return result.exitCode === 0 ? parseClientIds(result.stdout) : undefined
    },
  }
}

const UNLISTED =
  'the client lists no session under this sessionId, so nothing ran'
const UNREAD = 'the client listing could not be read, so nothing ran'

/**
 * Acts on each target in turn and judges it by the roster rather than by the
 * client's exit, since the client's own report is not reliable. The client id
 * resolves ahead of the dry-run branch, so a dry run reports the id it would
 * pass, and a target the client does not list is never acted on under a
 * guessed id. A session still live after the reads settle is `failed`,
 * carrying the client's output.
 */
export async function executeReap(
  targets: readonly Candidate[],
  remove: boolean,
  dryRun: boolean,
  effects: ReapEffects,
): Promise<readonly ReapRow[]> {
  const rows: ReapRow[] = []
  if (targets.length === 0) return rows
  const ids = await effects.clientIds()

  for (const target of targets) {
    const clientId = ids?.get(target.sessionId)
    if (clientId === undefined) {
      const gone = !(await effects.live()).has(target.sessionId)
      rows.push({
        ...target,
        outcome: gone ? 'gone' : 'failed',
        reason: null,
        detail: gone ? null : ids === undefined ? UNREAD : UNLISTED,
        clientId: null,
      })
      continue
    }

    if (dryRun) {
      rows.push({
        ...target,
        outcome: remove ? 'would-remove' : 'would-stop',
        reason: null,
        detail: null,
        clientId,
      })
      continue
    }

    const result = await effects.run(remove ? 'rm' : 'stop', clientId)
    let still = true
    for (let read = 0; read < SETTLE_READS; read++) {
      if (read > 0) await effects.pause(SETTLE_PAUSE_MS)
      still = (await effects.live()).has(target.sessionId)
      if (!still) break
    }

    rows.push(
      still
        ? {
            ...target,
            outcome: 'failed',
            reason: null,
            detail: result.output.trim() || `exit ${result.exitCode}`,
            clientId,
          }
        : {
            ...target,
            outcome: remove ? 'removed' : 'stopped',
            reason: null,
            detail: null,
            clientId,
          },
    )
  }

  return rows
}

const DIRS: readonly [TaskState, (root: string) => string][] = [
  ['live', tasksDir],
  ['archived', archiveDir],
  ['declined', declinedDir],
]

/**
 * Every task's `Sessions:` line across the board, the archive, and the
 * declined folder, since the post-merge hook moves a merged task before a reap
 * runs.
 */
export async function readTaskSessions(
  root: string,
): Promise<readonly TaskSessions[]> {
  const read = await Promise.all(
    DIRS.map(async ([state, dirOf]) => {
      const dir = dirOf(root)
      if (!existsSync(dir)) return []
      const names = (await readdir(dir))
        .filter((name) => name.endsWith('.md'))
        .sort()
      const tasks = await Promise.all(
        names
          .map((name) => name.slice(0, -'.md'.length))
          .filter((stem) => !isReservedStem(stem))
          .map(async (stem) => ({
            stem,
            state,
            entries: readSessions(
              await readFile(join(dir, `${stem}.md`), 'utf8'),
            ),
          })),
      )
      return tasks
    }),
  )

  return read.flat()
}
