import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { StopReport } from '@/listeners/stop'
import type { ResolvedSession } from '@/sessions/resolve'
import type { StopReading } from '@/sessions/stop'
import {
  archiveDir,
  declinedDir,
  isReservedStem,
  readPlanTargets,
  readPullRequest,
  readSessions,
  type SessionEntry,
  tasksDir,
} from '@/tasks/archive'
import type { TrunkReader } from '@/tasks/trunk'

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
  /** A recorded pull request reached the trunk, so nothing a session writes can reach the change. */
  readonly landed: boolean
  /** The task's `Plan:` line links a plan, so a planner's work is on the record. */
  readonly planned: boolean
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

/** Why a session was stopped, where the task alone showed it finished. */
export type StopReason = 'merged' | 'planned'

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
  readonly reason: SkipReason | StopReason | null
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
 * `shell` holds a background command, such as a preview server or a review
 * wait. It reads as finished only on archived or declined work, since on a
 * live task the command is usually a check the session still waits on.
 */
const SETTLED_STATUSES: readonly string[] = [...IDLE_STATUSES, 'shell']

const PLANNER_PREFIX = 'planner-'

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
  /** Set where the task, not the status, showed the session finished. */
  readonly reason?: StopReason
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
  finished: (status: string) => boolean,
): Pick<ReapRow, 'reason' | 'detail'> | null {
  const id = row.sessionId ?? ''
  if (id === guards.self) return { reason: 'caller', detail: null }
  if (guards.keep.includes(id)) return { reason: 'kept', detail: null }
  if (row.kind !== 'bg') return { reason: 'interactive', detail: row.kind }
  if (row.name.startsWith(CONTROLLER_PREFIX)) {
    return { reason: 'controller', detail: row.name }
  }
  if (row.name.includes(TALK_MARKER)) return { reason: 'talk', detail: null }
  if (!finished(row.status)) {
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

    const statuses = task.state === 'live' ? IDLE_STATUSES : SETTLED_STATUSES
    const planner = planned(row, task)
    const skip = sharedSkip(
      row,
      guards,
      tasks,
      task.stem,
      (status) =>
        task.landed ||
        statuses.includes(status) ||
        (planner && status === 'shell'),
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

    const reason = task.landed
      ? 'merged'
      : planner && row.status === 'shell'
        ? 'planned'
        : undefined
    targets.push({
      sessionId: entry.sessionId,
      name: row.name,
      ...(reason && !statuses.includes(row.status) ? { reason } : {}),
    })
  }

  return { settled, targets }
}

/**
 * A planner holding a feature branch may still be writing, so only a branchless
 * one on a task linking a plan counts as done.
 */
function planned(row: RosterRow, task: TaskSessions): boolean {
  return (
    task.planned && row.name.startsWith(PLANNER_PREFIX) && row.branch === null
  )
}

/**
 * The finished form takes a session recorded on settled tasks alone, or one no
 * task records idle past the threshold. Status alone never says done, so an
 * untasked session with no measured dwell is left alone.
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
    const skip = sharedSkip(row, guards, tasks, null, (status) =>
      (recorded ? SETTLED_STATUSES : IDLE_STATUSES).includes(status),
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
  /** Runs ahead of the client's `rm` on a listed target, outside a dry run. */
  readonly beforeRemove?: (sessionId: string) => Promise<void>
}

const SETTLE_READS = 6
const SETTLE_PAUSE_MS = 500

/**
 * The client's `stop` and `rm` match the short `id` it lists beside each full
 * `sessionId`, never the full one. Anything but an array of rows reads as
 * unreadable rather than as an empty listing.
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
 * Judges each target by the roster rather than the client's unreliable exit.
 * The client id resolves ahead of the dry-run branch, so a dry run reports
 * it, and an unlisted target is never acted on under a guessed id.
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
        sessionId: target.sessionId,
        name: target.name,
        outcome: gone ? 'gone' : 'failed',
        reason: null,
        detail: gone ? null : ids === undefined ? UNREAD : UNLISTED,
        clientId: null,
      })
      continue
    }

    const reason = target.reason ?? null
    if (dryRun) {
      rows.push({
        sessionId: target.sessionId,
        name: target.name,
        outcome: remove ? 'would-remove' : 'would-stop',
        reason,
        detail: null,
        clientId,
      })
      continue
    }

    if (remove) await effects.beforeRemove?.(target.sessionId)
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
            sessionId: target.sessionId,
            name: target.name,
            outcome: 'failed',
            reason,
            detail: result.output.trim() || `exit ${result.exitCode}`,
            clientId,
          }
        : {
            sessionId: target.sessionId,
            name: target.name,
            outcome: remove ? 'removed' : 'stopped',
            reason,
            detail: null,
            clientId,
          },
    )
  }

  return rows
}

const LINKED_WORKTREES = '/.claude/worktrees/'

/**
 * Only a worktree the session tooling creates counts, so a submodule or a
 * checkout made by hand elsewhere, whose common directory never names its
 * toplevel, is not mistaken for one.
 */
function isLinkedWorktree(worktree: string, repository: string | null) {
  return (
    worktree.includes(LINKED_WORKTREES) && `${worktree}/.git` !== repository
  )
}

/**
 * Never the main checkout, where a reviewer or planner runs and every listener
 * would match, and never a worktree a session outside the targets still
 * holds, since a server either one started serves both.
 */
export function listenerWorktrees(
  targets: readonly Candidate[],
  roster: readonly RosterRow[],
): ReadonlyMap<string, string> {
  const ids = new Set(targets.map((target) => target.sessionId))
  const paths = new Map<string, string>()
  for (const target of targets) {
    const row = roster.find((session) => session.sessionId === target.sessionId)
    const worktree = row?.worktree ?? null
    if (row === undefined || worktree === null) continue
    if (!isLinkedWorktree(worktree, row.repository)) continue
    const shared = roster.some(
      (session) =>
        session.worktree === worktree && !ids.has(session.sessionId ?? ''),
    )
    if (!shared) paths.set(target.sessionId, worktree)
  }
  return paths
}

export interface ListenerEffects {
  /** Ends every listener inside the given worktrees, or reports what would end. */
  readonly stop: (
    paths: readonly string[],
    dryRun: boolean,
  ) => Promise<StopReport>
}

export interface ReapResult {
  readonly sessions: readonly ReapRow[]
  /** What the listener step ended, or null where no target had a worktree it could end. */
  readonly listeners: StopReport | null
}

/** `gone` is a session already off the roster, whose server is the orphan this step exists for. */
const ENDS_LISTENERS: readonly ReapOutcome[] = [
  'gone',
  'stopped',
  'removed',
  'would-stop',
  'would-remove',
]

function merge(reports: readonly StopReport[]): StopReport | null {
  if (reports.length === 0) return null
  if (reports.some((report) => report.kind === 'unread')) {
    return { kind: 'unread' }
  }
  return {
    kind: 'read',
    stopped: reports.flatMap((report) =>
      report.kind === 'read' ? report.stopped : [],
    ),
  }
}

/**
 * A stop ends listeners only once every target in that worktree left the
 * roster, so a live session keeps its server. A remove ends them ahead of the
 * client's removal, which may delete the directory the server runs in.
 */
export async function reapTargets(
  targets: readonly Candidate[],
  roster: readonly RosterRow[],
  remove: boolean,
  dryRun: boolean,
  effects: ReapEffects & ListenerEffects,
): Promise<ReapResult> {
  const worktrees = listenerWorktrees(targets, roster)
  const reports: StopReport[] = []
  const ended = new Set<string>()

  const sessions = await executeReap(targets, remove, dryRun, {
    ...effects,
    beforeRemove: async (sessionId) => {
      const path = worktrees.get(sessionId)
      if (path === undefined || ended.has(path)) return
      ended.add(path)
      reports.push(await effects.stop([path], false))
    },
  })

  if (!remove || dryRun) {
    const paths = [...new Set(worktrees.values())].filter((path) =>
      sessions.every(
        (row) =>
          worktrees.get(row.sessionId) !== path ||
          ENDS_LISTENERS.includes(row.outcome),
      ),
    )
    if (paths.length > 0) reports.push(await effects.stop(paths, dryRun))
  }

  return { sessions, listeners: merge(reports) }
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
  landed?: LandedRead,
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
          .map(async (stem) => {
            const text = await readFile(join(dir, `${stem}.md`), 'utf8')
            return {
              stem,
              state,
              entries: readSessions(text),
              landed:
                landed?.stem === stem && (await landedOn(text, landed.trunk)),
              planned: readPlanTargets(text).length > 0,
            }
          }),
      )
      return tasks
    }),
  )

  return read.flat()
}

/**
 * The one task whose pull requests the trunk is asked about. Only a named task
 * reads its own `landed`, and a board holds a thousand archived ones, so
 * reading the trunk for each would cost minutes of git on every call.
 */
export interface LandedRead {
  readonly stem: string
  readonly trunk: TrunkReader
}

/**
 * The post-merge hook archives a merged task, so an archived one is read too.
 * An unreadable trunk reads as not landed, which keeps the skip a reap made
 * before this test.
 */
async function landedOn(text: string, trunk: TrunkReader): Promise<boolean> {
  const numbers = readPullRequest(text)
  if (numbers.length === 0) return false
  const read = await Promise.all(numbers.map((number) => trunk(number)))
  return read.every((landed) => landed === true)
}
