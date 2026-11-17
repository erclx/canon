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
}

export type RosterRow = ResolvedSession & Pick<StopReading, 'stopped'>

/**
 * `waiting` is the ordinary status of a background session that reported and
 * ended its turn, so it reads as finished beside `idle`. `shell` is a turn
 * ended with a background command still held, such as a worker's preview
 * server or a review wait, which most finished workers and reviewers read, so
 * a session a task recorded takes it as finished too. Every other status,
 * `busy` among them, has a turn still running.
 */
const SETTLED_STATUSES: readonly string[] = ['idle', 'waiting', 'shell']

/**
 * A session no task records says nothing about its work but its status, so a
 * held background command keeps it alive there.
 */
const UNTASKED_SETTLED: readonly string[] = ['idle', 'waiting']

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
): Pick<ReapRow, 'reason' | 'detail'> | null {
  const id = row.sessionId ?? ''
  if (id === guards.self) return { reason: 'caller', detail: null }
  if (guards.keep.includes(id)) return { reason: 'kept', detail: null }
  if (row.kind !== 'bg') return { reason: 'interactive', detail: row.kind }
  if (row.name.startsWith(CONTROLLER_PREFIX)) {
    return { reason: 'controller', detail: row.name }
  }
  if (row.name.includes(TALK_MARKER)) return { reason: 'talk', detail: null }
  if (!SETTLED_STATUSES.includes(row.status)) {
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

    const skip = sharedSkip(row, guards, tasks, task.stem)
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
    const skip = sharedSkip(row, guards, tasks, null)
    if (skip) {
      settled.push({
        sessionId: id,
        name: row.name,
        outcome: 'skipped',
        ...skip,
      })
      continue
    }

    const recorded = tasks.some((task) =>
      task.entries.some((entry) => entry.sessionId === id),
    )
    if (!recorded && !UNTASKED_SETTLED.includes(row.status)) {
      settled.push({
        sessionId: id,
        name: row.name,
        outcome: 'skipped',
        reason: 'busy',
        detail: row.status,
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

export interface ReapEffects {
  /** Runs `claude stop <id>` or `claude rm <id>`. */
  readonly run: (verb: 'stop' | 'rm', id: string) => Promise<ClientResult>
  /** The sessionIds still live on the roster, read fresh. */
  readonly live: () => Promise<ReadonlySet<string>>
  /** Waits between roster reads while a stopped process exits. */
  readonly pause: (ms: number) => Promise<void>
}

const SETTLE_READS = 6
const SETTLE_PAUSE_MS = 500

/**
 * Acts on each target in turn and judges it by the roster rather than by the
 * client's exit, since the client's own report is not reliable. A session
 * still live after the reads settle is `failed`, carrying the client's output.
 */
export async function executeReap(
  targets: readonly Candidate[],
  remove: boolean,
  dryRun: boolean,
  effects: ReapEffects,
): Promise<readonly ReapRow[]> {
  const rows: ReapRow[] = []

  for (const target of targets) {
    if (dryRun) {
      rows.push({
        ...target,
        outcome: remove ? 'would-remove' : 'would-stop',
        reason: null,
        detail: null,
      })
      continue
    }

    const result = await effects.run(remove ? 'rm' : 'stop', target.sessionId)
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
          }
        : {
            ...target,
            outcome: remove ? 'removed' : 'stopped',
            reason: null,
            detail: null,
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
