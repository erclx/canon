import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import {
  type AnswerRefusal,
  type OpenQuestion,
  planAnswers,
} from '@/tasks/answers'
import {
  describeUnmatchedStem,
  listTaskStems,
  readPlanTargets,
  tasksDir,
} from '@/tasks/archive'

export const DEFAULT_LAUNCH_WAIT_SECONDS = 1800
export const LAUNCH_POLL_MS = 30_000

export type LaunchRefusal =
  | AnswerRefusal
  | 'no-board'
  | 'no-match'
  | 'ambiguous'
  | 'several-plans'

export interface LaunchRefused {
  readonly ok: false
  readonly reason: LaunchRefusal
  readonly message: string
  readonly detail: readonly string[]
}

/**
 * One reading of a row. `reason` is `unlinked` while the task carries no
 * `Plan:` line, `open` while its plan holds a question for the operator, and
 * `launchable` once it holds none. `plan` and `open` keep the names
 * `plan-answers` gives them, so the dispatch reads one concept by one name.
 */
export interface LaunchReading {
  readonly ok: true
  readonly task: string
  readonly plan?: string
  readonly reason: 'unlinked' | 'open' | 'launchable'
  readonly launchable: boolean
  readonly open: readonly OpenQuestion[]
}

export type LaunchOutcome = LaunchReading | LaunchRefused

/**
 * The record a wait ends on. A reading ends `launchable` or, at the deadline,
 * `timeout` carrying the last reading, so the caller still sees which question
 * holds the row. A refusal ends the wait at once, since nothing a planner
 * writes next turns an archived plan or an unknown task launchable.
 */
export type LaunchWait =
  | (Omit<LaunchReading, 'reason'> & {
      readonly reason: 'launchable' | 'timeout'
      readonly waitedSeconds: number
    })
  | (LaunchRefused & { readonly waitedSeconds: number })

export interface LaunchClock {
  now(): number
  sleep(ms: number): Promise<void>
}

export interface LaunchWaitOptions {
  readonly waitSeconds: number
  readonly clock: LaunchClock
  readonly pollMs?: number
}

/**
 * Reads a row by its task stem: resolves the task's `Plan:` line, then runs the
 * `plan-answers` gate on the plan it names. Keying on the line rather than on
 * the plan file is what keeps a plan still being written from reading as
 * landed, since a planner links it only after it validates.
 *
 * It reports and never writes, and answers planning alone. The branch and
 * claim checks stay with the dispatch runbook, which owns them.
 */
export async function readLaunchable(
  root: string,
  task: string,
): Promise<LaunchOutcome> {
  const dir = tasksDir(root)
  if (!existsSync(dir)) {
    return refuse('no-board', `No task board at ${relative(root, dir)}.`)
  }

  const stems = await listTaskStems(dir)
  if (!stems.includes(task)) {
    const { reason, message, detail } = describeUnmatchedStem(stems, task)
    return refuse(reason, message, detail)
  }

  const targets = readPlanTargets(
    await readFile(join(dir, `${task}.md`), 'utf8'),
  )
  const [target] = targets
  if (target === undefined) {
    return { ok: true, task, reason: 'unlinked', launchable: false, open: [] }
  }
  if (targets.length > 1) {
    return refuse(
      'several-plans',
      `${task} links ${targets.length} plans, so no single plan is the one to dispatch.`,
      targets,
    )
  }

  const answers = await planAnswers(root, target)
  if (!answers.ok) return answers

  return {
    ok: true,
    task,
    plan: answers.plan,
    reason: answers.launchable ? 'launchable' : 'open',
    launchable: answers.launchable,
    open: answers.open,
  }
}

/**
 * Re-reads the row every `pollMs` until it is launchable, a read refuses, or
 * the next reading would land past the deadline.
 */
export async function waitForLaunchable(
  root: string,
  task: string,
  opts: LaunchWaitOptions,
): Promise<LaunchWait> {
  const { clock } = opts
  const pollMs = opts.pollMs ?? LAUNCH_POLL_MS
  const started = clock.now()
  const deadline = started + opts.waitSeconds * 1000
  const waited = () => Math.round((clock.now() - started) / 1000)

  for (;;) {
    const reading = await readLaunchable(root, task)
    if (!reading.ok) return { ...reading, waitedSeconds: waited() }
    if (reading.launchable) {
      return { ...reading, reason: 'launchable', waitedSeconds: waited() }
    }
    if (clock.now() + pollMs > deadline) {
      return { ...reading, reason: 'timeout', waitedSeconds: waited() }
    }
    await clock.sleep(pollMs)
  }
}

function refuse(
  reason: LaunchRefusal,
  message: string,
  detail: readonly string[] = [],
): LaunchRefused {
  return { ok: false, reason, message, detail }
}
