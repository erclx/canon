import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'
import { planCandidates } from '@/tasks/answers'
import { branchOfPlan } from '@/tasks/branch'
import {
  appendPlanLink,
  describeUnmatchedStem,
  fenceMask,
  linkTo,
  listTaskStems,
  OUTCOME_PATTERN,
  STRUCK_BODY_PATTERN,
  planLine,
  planLineIndex,
  readPendingBranches,
  readPlanTargets,
  readPullRequest,
  readSessions,
  SESSION_ID_PATTERN,
  SESSIONS_PREFIX,
  tasksDir,
} from '@/tasks/archive'
import {
  checkWaiting,
  type LinkPromotion,
  promoteOnLink,
  rerenderFlight,
} from '@/tasks/board'

/**
 * Lines a task carries above its outcomes naming where the work came from. The
 * `Pull request:` line joins them, so the last one present is the anchor.
 */
const ORIGIN_PREFIXES = ['Plan:', 'Groundwork:', 'Intake:', 'Issue:'] as const

/**
 * `bad-input` stands apart from the board-state reasons, since `git-pr` swallows
 * `no-board`, `no-match`, and `ambiguous`, but a malformed argument is a defect
 * nobody else hears. `several-plans` answers a `Plan:` line already linking many.
 */
export const RECORD_REFUSALS = [
  'no-board',
  'no-match',
  'ambiguous',
  'no-outcomes',
  'out-of-range',
  'already-closed',
  'no-plan',
  'several-plans',
  'bad-input',
  'no-name',
  'unregistered',
  'ambiguous-id',
] as const

export type RecordRefusal = (typeof RECORD_REFUSALS)[number]

export interface RecordRefused {
  readonly ok: false
  readonly reason: RecordRefusal
  readonly message: string
  readonly detail: readonly string[]
}

export type RecordSelector =
  | { readonly kind: 'stem'; readonly stem: string }
  | { readonly kind: 'plan'; readonly plan: string }
  | { readonly kind: 'branch'; readonly branches: readonly string[] }

export type LineAction = 'added' | 'appended' | 'corrected' | 'unchanged'

export interface PullRequestRecorded {
  readonly ok: true
  readonly stem: string
  readonly path: string
  readonly number: number
  readonly action: LineAction
  /** Branches still on the `Pending branch:` line after this write. */
  readonly pending: readonly string[]
}

export type PullRequestOutcome = PullRequestRecorded | RecordRefused

export interface PlanRecorded {
  readonly ok: true
  readonly stem: string
  readonly path: string
  readonly plan: string
  readonly action: LineAction
  /** The target the line named before a correction. Undefined unless it differed. */
  readonly replaced: string | undefined
  /** Whether the link moved the task's row out of `## Needs a plan`. */
  readonly board: LinkPromotion
}

export type PlanOutcome = PlanRecorded | RecordRefused

export interface SessionRecorded {
  readonly ok: true
  readonly stem: string
  readonly path: string
  readonly sessionId: string
  /** The name the line carries for the id, which a repeat call never renames. */
  readonly name: string
  readonly action: Exclude<LineAction, 'corrected'>
}

export type SessionOutcome = SessionRecorded | RecordRefused

export interface OutcomesClosed {
  readonly ok: true
  readonly stem: string
  readonly path: string
  readonly closed: readonly string[]
  readonly alreadyClosed: readonly string[]
  readonly cut: readonly string[]
  readonly alreadyCut: readonly string[]
  /** Branches on the `Pending branch:` line after this write. */
  readonly pending: readonly string[]
}

export type CloseOutcome = OutcomesClosed | RecordRefused

/** Outcomes the operator decided against, struck with one reason per call. */
export interface OutcomeCuts {
  readonly positions: readonly number[]
  readonly reason: string
}

function refuse(
  reason: RecordRefusal,
  message: string,
  detail: readonly string[] = [],
): RecordRefused {
  return { ok: false, reason, message, detail }
}

/**
 * Reduces a plan reference to the token both spellings share. A task's `Plan:`
 * line carries a path, a caller carries the branch slug, and the two differ by
 * the folder, the extension, and the `feature-` prefix the filename adds.
 */
function planKey(reference: string): string {
  const stem = basename(reference).replace(/\.md$/, '')
  return stem.startsWith('feature-') ? stem.slice('feature-'.length) : stem
}

/**
 * Places the `Pull request:` line under the origin lines the task carries. A new
 * number appends to an existing list line and a non-list line is replaced whole.
 * A task with no origin line takes it under the H1, the only other anchor.
 */
export function writePullRequestLine(
  text: string,
  number: number,
): { readonly text: string; readonly action: LineAction } {
  const line = `Pull request: #${number}`
  const lines = text.split('\n')
  const existing = lines.findIndex((entry) => entry.startsWith('Pull request:'))

  if (existing !== -1) {
    const listed = readPullRequest(lines[existing])
    if (listed.includes(number)) return { text, action: 'unchanged' }
    if (listed.length === 0) {
      lines[existing] = line
      return { text: lines.join('\n'), action: 'corrected' }
    }
    lines[existing] = `${lines[existing].trimEnd()}, #${number}`
    return { text: lines.join('\n'), action: 'appended' }
  }

  const origin = lastOriginLine(lines)
  if (origin !== undefined) {
    lines.splice(origin + 1, 0, line)
    return { text: lines.join('\n'), action: 'added' }
  }

  const heading = lines.findIndex((entry) => entry.startsWith('# '))
  if (heading === -1) return { text: `${line}\n${text}`, action: 'added' }

  lines.splice(heading + 1, 0, '', line)
  return { text: lines.join('\n'), action: 'added' }
}

function lastOriginLine(
  lines: readonly string[],
  prefixes: readonly string[] = ORIGIN_PREFIXES,
): number | undefined {
  let found: number | undefined

  for (const [index, line] of lines.entries()) {
    if (prefixes.some((prefix) => line.startsWith(prefix))) found = index
  }

  return found
}

const PENDING_PREFIX = 'Pending branch:'

/**
 * Names a branch on the `Pending branch:` line, which holds the task open
 * against a merge-time archive until that branch's number is recorded. It sits
 * under `Pull request:` when one exists, since a later slice ticks after it.
 */
export function writePendingBranch(
  text: string,
  branch: string,
): { readonly text: string; readonly changed: boolean } {
  const lines = text.split('\n')
  const existing = lines.findIndex((entry) => entry.startsWith(PENDING_PREFIX))

  if (existing !== -1) {
    const pending = readPendingBranches(lines[existing])
    if (pending.includes(branch)) return { text, changed: false }
    lines[existing] = `${PENDING_PREFIX} ${[...pending, branch].join(', ')}`
    return { text: lines.join('\n'), changed: true }
  }

  const line = `${PENDING_PREFIX} ${branch}`
  const anchor = lastOriginLine(lines, [...ORIGIN_PREFIXES, 'Pull request:'])
  if (anchor !== undefined) {
    lines.splice(anchor + 1, 0, line)
    return { text: lines.join('\n'), changed: true }
  }

  const heading = lines.findIndex((entry) => entry.startsWith('# '))
  if (heading === -1) return { text: `${line}\n${text}`, changed: true }

  lines.splice(heading + 1, 0, '', line)
  return { text: lines.join('\n'), changed: true }
}

/** Drops a branch from the `Pending branch:` line, and the line once it is empty. */
export function clearPendingBranch(
  text: string,
  branch: string,
): { readonly text: string; readonly changed: boolean } {
  const lines = text.split('\n')
  const existing = lines.findIndex((entry) => entry.startsWith(PENDING_PREFIX))
  if (existing === -1) return { text, changed: false }

  const pending = readPendingBranches(lines[existing])
  if (!pending.includes(branch)) return { text, changed: false }

  const rest = pending.filter((entry) => entry !== branch)
  if (rest.length > 0) {
    lines[existing] = `${PENDING_PREFIX} ${rest.join(', ')}`
  } else {
    lines.splice(existing, 1)
  }

  return { text: lines.join('\n'), changed: true }
}

/**
 * Names a session on the `Sessions:` line, keyed on the id, so a dispatcher and
 * `git-pr` recording one worker write it once. The line sits below every other
 * line above the outcomes, so a pull request recorded later lands above it.
 */
export function writeSessionsLine(
  text: string,
  name: string,
  sessionId: string,
): { readonly text: string; readonly action: SessionRecorded['action'] } {
  const entry = `${name} (${sessionId})`
  const lines = text.split('\n')
  const existing = lines.findIndex((line) => line.startsWith(SESSIONS_PREFIX))

  if (existing !== -1) {
    if (lines[existing].includes(`(${sessionId})`)) {
      return { text, action: 'unchanged' }
    }
    lines[existing] = `${lines[existing].trimEnd()}, ${entry}`
    return { text: lines.join('\n'), action: 'appended' }
  }

  const line = `${SESSIONS_PREFIX} ${entry}`
  const anchor = lastOriginLine(lines, [
    ...ORIGIN_PREFIXES,
    'Pull request:',
    PENDING_PREFIX,
  ])
  if (anchor !== undefined) {
    lines.splice(anchor + 1, 0, line)
    return { text: lines.join('\n'), action: 'added' }
  }

  const heading = lines.findIndex((entry) => entry.startsWith('# '))
  if (heading === -1) return { text: `${line}\n${text}`, action: 'added' }

  lines.splice(heading + 1, 0, '', line)
  return { text: lines.join('\n'), action: 'added' }
}

export type PlanLineWrite =
  | {
      readonly ok: true
      readonly text: string
      readonly action: LineAction
      readonly replaced: string | undefined
    }
  | { readonly ok: false; readonly targets: readonly string[] }

/**
 * Places the `Plan:` line right after the H1, and corrects the target in place
 * when it exists. A line linking several plans is refused whole, since
 * overwriting drops links; `add` keeps every link in order and never refuses one.
 */
export function writePlanLine(
  text: string,
  target: string,
  add = false,
): PlanLineWrite {
  const line = planLine(target)
  const lines = text.split('\n')
  const existing = planLineIndex(lines)

  if (existing !== -1 && add) {
    if (readPlanTargets(lines[existing]).includes(target)) {
      return { ok: true, text, action: 'unchanged', replaced: undefined }
    }
    lines[existing] = appendPlanLink(lines[existing], target)
    return {
      ok: true,
      text: lines.join('\n'),
      action: 'appended',
      replaced: undefined,
    }
  }

  if (existing !== -1) {
    const targets = readPlanTargets(lines[existing])
    if (targets.length > 1) return { ok: false, targets }

    const [previous] = targets
    const replaced = previous !== target ? previous : undefined
    if (lines[existing] === line) {
      return { ok: true, text, action: 'unchanged', replaced }
    }
    lines[existing] = line
    return { ok: true, text: lines.join('\n'), action: 'corrected', replaced }
  }

  const heading = lines.findIndex((entry) => entry.startsWith('# '))
  if (heading === -1) {
    return {
      ok: true,
      text: `${line}\n${text}`,
      action: 'added',
      replaced: undefined,
    }
  }

  lines.splice(heading + 1, 0, '', line)
  return {
    ok: true,
    text: lines.join('\n'),
    action: 'added',
    replaced: undefined,
  }
}

/**
 * Marks outcomes closed by their 1-based position in the task's outcome list,
 * since a caller reading the file already holds it. A cut strikes the body and
 * keeps its `[ ]`, and no write may make one line claim both shipped and cut.
 */
export function closeOutcomeLines(
  text: string,
  positions: readonly number[],
  cutPositions: readonly number[] = [],
  reason = '',
): {
  readonly text: string
  readonly closed: readonly string[]
  readonly alreadyClosed: readonly string[]
  /** Ticked outcomes a cut named, which no write may strike. */
  readonly cutClosed: readonly string[]
  readonly cut: readonly string[]
  readonly alreadyCut: readonly string[]
  readonly total: number
} {
  const wanted = new Set(positions)
  const cutting = new Set(cutPositions)
  const closed: string[] = []
  const alreadyClosed: string[] = []
  const cutClosed: string[] = []
  const cut: string[] = []
  const alreadyCut: string[] = []
  const lines = text.split('\n')
  const fenced = fenceMask(lines)
  let seen = 0

  const rewritten = lines.map((line, index) => {
    if (fenced[index]) return line

    const match = OUTCOME_PATTERN.exec(line)
    if (!match) return line

    seen += 1
    if (!wanted.has(seen) && !cutting.has(seen)) return line

    const [, box, body] = match
    const trimmed = body.trim()

    if (STRUCK_BODY_PATTERN.test(trimmed)) {
      alreadyCut.push(trimmed)
      return line
    }

    if (box !== ' ') {
      if (cutting.has(seen)) cutClosed.push(trimmed)
      else alreadyClosed.push(trimmed)
      return line
    }

    if (cutting.has(seen)) {
      cut.push(trimmed)
      return `- [ ] ~~${trimmed}~~ ${reason.trim()}`.trimEnd()
    }

    closed.push(trimmed)
    return body ? `- [x] ${body}` : '- [x]'
  })

  return {
    text: rewritten.join('\n'),
    closed,
    alreadyClosed,
    cutClosed,
    cut,
    alreadyCut,
    total: seen,
  }
}

async function matchByPlan(
  dir: string,
  stems: readonly string[],
  plan: string,
): Promise<string[]> {
  const key = planKey(plan)

  const read = await Promise.all(
    stems.map(async (stem) => ({
      stem,
      targets: readPlanTargets(await readFile(join(dir, `${stem}.md`), 'utf8')),
    })),
  )

  return read
    .filter((entry) => entry.targets.some((target) => planKey(target) === key))
    .map(({ stem }) => stem)
}

async function resolveStem(
  dir: string,
  selector: RecordSelector,
): Promise<string | RecordRefused> {
  const stems = await listTaskStems(dir)

  if (selector.kind === 'stem') {
    if (!stems.includes(selector.stem)) {
      const { reason, message, detail } = describeUnmatchedStem(
        stems,
        selector.stem,
      )
      return refuse(reason, message, detail)
    }
    return selector.stem
  }

  if (selector.kind === 'branch') {
    const matched = await matchByBranch(dir, stems, selector.branches)
    const label = selector.branches[0] ?? 'no branch'

    if (matched.length === 0) {
      return refuse('no-match', `No task's plan derives branch ${label}.`)
    }

    if (matched.length > 1) {
      return refuse(
        'ambiguous',
        `${matched.length} tasks derive branch ${label}. One task, one plan.`,
        matched,
      )
    }

    return matched[0]
  }

  const matched = await matchByPlan(dir, stems, selector.plan)

  if (matched.length === 0) {
    return refuse('no-match', `No task names plan ${selector.plan}.`)
  }

  if (matched.length > 1) {
    return refuse(
      'ambiguous',
      `${matched.length} tasks name plan ${selector.plan}. One task, one plan.`,
      matched,
    )
  }

  return matched[0]
}

/**
 * Matches a branch to the tasks whose plan derives it. A task with no `Plan:`
 * line carries no target and so never matches.
 */
async function matchByBranch(
  dir: string,
  stems: readonly string[],
  branches: readonly string[],
): Promise<string[]> {
  const read = await Promise.all(
    stems.map(async (stem) => ({
      stem,
      targets: readPlanTargets(await readFile(join(dir, `${stem}.md`), 'utf8')),
    })),
  )

  return read
    .filter((entry) =>
      entry.targets.some((target) => branches.includes(branchOfPlan(target))),
    )
    .map(({ stem }) => stem)
}

export async function openTask(
  root: string,
  selector: RecordSelector,
): Promise<{ readonly stem: string; readonly path: string } | RecordRefused> {
  const dir = tasksDir(root)

  if (!existsSync(dir)) {
    return refuse('no-board', `No task board at ${relative(root, dir)}.`)
  }

  const resolved = await resolveStem(dir, selector)
  if (typeof resolved !== 'string') return resolved

  return { stem: resolved, path: join(dir, `${resolved}.md`) }
}

/**
 * Records a pull request number on the task the branch closes, resolving the
 * board root in-process, since a linked worktree refuses an in-place edit.
 * `branches` carries every name before a rename, whose markers a rerun repairs.
 */
export async function recordPullRequest(
  root: string,
  selector: RecordSelector,
  number: number,
  branches: readonly string[] = [],
): Promise<PullRequestOutcome> {
  const opened = await openTask(root, selector)
  if ('ok' in opened) return opened

  const { stem, path } = opened
  const numbered = writePullRequestLine(await readFile(path, 'utf8'), number)
  let text = numbered.text
  let isCleared = false

  for (const branch of branches) {
    const cleared = clearPendingBranch(text, branch)
    text = cleared.text
    isCleared ||= cleared.changed
  }

  if (numbered.action !== 'unchanged' || isCleared) await writeFile(path, text)

  return {
    ok: true,
    stem,
    path,
    number,
    action: numbered.action,
    pending: readPendingBranches(text),
  }
}

/**
 * Records a plan's path on the task it belongs to, as the task's `Plan:` line.
 * `plan-change` runs this once the plan lands, resolving the reference through
 * `planCandidates`. The caller holds the task stem, so it is named directly.
 */
export async function recordPlan(
  root: string,
  stem: string,
  reference: string,
  add = false,
  waiting?: string,
): Promise<PlanOutcome> {
  if (waiting !== undefined) {
    const bad = checkWaiting(waiting)
    if (bad) return refuse('bad-input', bad.message, bad.detail)
  }

  const opened = await openTask(root, { kind: 'stem', stem })
  if ('ok' in opened) return opened

  const { path } = opened
  const dir = tasksDir(root)
  const candidates = planCandidates(root, reference)
  const plan = candidates.find((candidate) => existsSync(candidate))

  if (!plan) {
    const looked = candidates.map((entry) => relative(root, entry)).join(' or ')
    return refuse('no-plan', `No plan at ${looked}.`, [reference])
  }

  const target = linkTo(dir, plan)
  const written = writePlanLine(await readFile(path, 'utf8'), target, add)

  if (!written.ok) {
    return refuse(
      'several-plans',
      `${opened.stem} already links ${written.targets.length} plans on its Plan: line, so plan-link cannot tell which one to replace. Edit the line by hand to name one plan.`,
      written.targets,
    )
  }

  const { text, action, replaced } = written
  if (action !== 'unchanged') await writeFile(path, text)

  const board = await promoteOnLink(root, opened.stem, { waiting })

  return {
    ok: true,
    stem: opened.stem,
    path,
    plan: target,
    action,
    replaced,
    board,
  }
}

/** The 8-character id `claude --bg` prints, which the roster carries as a prefix. */
const SHORT_SESSION_ID_PATTERN = /^[0-9a-f]{8}$/

/**
 * A launch records its worker before the new session registers, which ran three
 * to eight seconds, so the wait covers that and stops a failed launch soon after.
 */
const REGISTRATION_ATTEMPTS = 15
const REGISTRATION_INTERVAL_MS = 1000

export interface RosterRow {
  readonly sessionId: string | null
  readonly name: string
}

export interface RegistrationWait {
  readonly sleep: (ms: number) => Promise<void>
  readonly attempts?: number
  readonly intervalMs?: number
}

export type SessionIdResolution =
  | {
      readonly ok: true
      readonly sessionId: string
      readonly name: string | undefined
    }
  | RecordRefused

/**
 * Resolves a full or short id to a full sessionId and its roster name. A short id
 * waits for registration, and refuses `ambiguous-id` rather than misroute a worker.
 */
export async function resolveSessionId(
  argument: string,
  readRoster: () => Promise<readonly RosterRow[]>,
  wait: RegistrationWait,
): Promise<SessionIdResolution> {
  if (argument.length === 0) {
    return refuse(
      'bad-input',
      'Empty sessionId. A lookup by name returns nothing until the session has registered, so pass the 8-character id the launch printed.',
      [argument],
    )
  }

  if (SESSION_ID_PATTERN.test(argument)) {
    const row = (await readRoster()).find((r) => r.sessionId === argument)
    return { ok: true, sessionId: argument, name: row?.name }
  }

  if (!SHORT_SESSION_ID_PATTERN.test(argument)) {
    return refuse(
      'bad-input',
      `Not a sessionId: ${argument}. Pass the 8-character id the launch printed, or the full id canon sessions list --json carries.`,
      [argument],
    )
  }

  const attempts = wait.attempts ?? REGISTRATION_ATTEMPTS
  const intervalMs = wait.intervalMs ?? REGISTRATION_INTERVAL_MS
  for (let attempt = 0; ; attempt += 1) {
    const matches = new Map<string, string>()
    for (const row of await readRoster()) {
      if (row.sessionId?.startsWith(`${argument}-`)) {
        matches.set(row.sessionId, row.name)
      }
    }

    if (matches.size > 1) {
      return refuse(
        'ambiguous-id',
        `${matches.size} live sessions start with ${argument}. Pass the full sessionId.`,
        [...matches.keys()],
      )
    }

    const [match] = matches
    if (match) return { ok: true, sessionId: match[0], name: match[1] }

    if (attempt >= attempts) break
    await wait.sleep(intervalMs)
  }

  return refuse(
    'unregistered',
    `No live session starts with ${argument} after ${(attempts * intervalMs) / 1000}s. The launch may have failed, or the session already exited.`,
    [argument],
  )
}

/**
 * Records a session that worked a task on its `Sessions:` line. The caller
 * resolves `name`, and an undefined one refuses rather than writing a bare id.
 * The id is checked first, since a malformed one would be hidden by later checks.
 */
export async function recordSession(
  root: string,
  selector: RecordSelector,
  sessionId: string,
  name: string | undefined,
): Promise<SessionOutcome> {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    return refuse(
      'bad-input',
      `Not a full sessionId: ${sessionId}. Pass the whole id canon sessions list --json carries.`,
      [sessionId],
    )
  }

  if (name === undefined) {
    return refuse(
      'no-name',
      `No live session carries ${sessionId}, so its name cannot be read. Pass --name.`,
      [sessionId],
    )
  }

  const trimmed = name.trim()
  if (trimmed.length === 0 || /[\r\n]/.test(trimmed)) {
    return refuse('bad-input', 'A session name is one non-empty line.', [name])
  }

  const opened = await openTask(root, selector)
  if ('ok' in opened) return opened

  const { stem, path } = opened
  const written = writeSessionsLine(
    await readFile(path, 'utf8'),
    trimmed,
    sessionId,
  )
  if (written.action !== 'unchanged') {
    await writeFile(path, written.text)
    await rerenderFlight(root, stem)
  }

  const listed = readSessions(written.text).find(
    (entry) => entry.sessionId === sessionId,
  )

  return {
    ok: true,
    stem,
    path,
    sessionId,
    name: listed?.name ?? trimmed,
    action: written.action,
  }
}

/**
 * Marks the named outcomes `[x]`, and strikes the `cuts` with their reason, in
 * place. A `branch` ticking a new box goes on the `Pending branch:` line so an
 * earlier slice's merge cannot archive the task first, and a cut alone writes none.
 */
export async function closeOutcomes(
  root: string,
  selector: RecordSelector,
  positions: readonly number[],
  branch?: string,
  branchPulls: readonly number[] = [],
  cuts: OutcomeCuts = { positions: [], reason: '' },
): Promise<CloseOutcome> {
  const opened = await openTask(root, selector)
  if ('ok' in opened) return opened

  const { stem, path } = opened
  const result = closeOutcomeLines(
    await readFile(path, 'utf8'),
    positions,
    cuts.positions,
    cuts.reason,
  )

  if (result.total === 0) {
    return refuse('no-outcomes', `${stem} carries no outcomes to close.`)
  }

  const beyond = [...positions, ...cuts.positions].filter(
    (position) => position < 1 || position > result.total,
  )

  if (beyond.length > 0) {
    return refuse(
      'out-of-range',
      `${stem} carries ${result.total} outcome(s), so ${beyond.join(', ')} names nothing.`,
      beyond.map(String),
    )
  }

  if (result.cutClosed.length > 0) {
    return refuse(
      'already-closed',
      `${stem} ticked ${result.cutClosed.length} outcome(s) a cut names, and a shipped outcome is not cut. Nothing was written.`,
      result.cutClosed,
    )
  }

  const recorded = readPullRequest(result.text).some((number) =>
    branchPulls.includes(number),
  )

  const text =
    result.closed.length > 0 && branch && !recorded
      ? writePendingBranch(result.text, branch).text
      : result.text

  if (result.closed.length > 0 || result.cut.length > 0) {
    await writeFile(path, text)
  }

  return {
    ok: true,
    stem,
    path,
    closed: result.closed,
    alreadyClosed: result.alreadyClosed,
    cut: result.cut,
    alreadyCut: result.alreadyCut,
    pending: readPendingBranches(text),
  }
}
