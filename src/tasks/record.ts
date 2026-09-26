import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'
import { planCandidates } from '@/tasks/answers'
import {
  describeUnmatchedStem,
  fenceMask,
  linkTo,
  listTaskStems,
  OUTCOME_PATTERN,
  planLine,
  planLineIndex,
  readPlanTargets,
  readPullRequest,
  tasksDir,
} from '@/tasks/archive'

/**
 * Lines a task carries above its outcomes naming where the work came from. The
 * `Pull request:` line joins them, so the last one present is the anchor.
 */
const ORIGIN_PREFIXES = ['Plan:', 'Groundwork:', 'Intake:', 'Issue:'] as const

/**
 * `bad-input` is separated from the board-state reasons on purpose. `git-pr`
 * swallows `no-board`, `no-match`, and `ambiguous`, because each is a case where
 * a guessed write would archive the wrong task. A caller that passed a
 * malformed argument has a defect nobody would otherwise hear about, so it
 * reports rather than joining the swallowed set.
 *
 * `several-plans` answers a `Plan:` line that already links more than one plan.
 * `plan-link` cannot know which link to drop, so it writes nothing.
 */
export const RECORD_REFUSALS = [
  'no-board',
  'no-match',
  'ambiguous',
  'no-outcomes',
  'out-of-range',
  'no-plan',
  'several-plans',
  'bad-input',
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

export type LineAction = 'added' | 'appended' | 'corrected' | 'unchanged'

export interface PullRequestRecorded {
  readonly ok: true
  readonly stem: string
  readonly path: string
  readonly number: number
  readonly action: LineAction
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
}

export type PlanOutcome = PlanRecorded | RecordRefused

export interface OutcomesClosed {
  readonly ok: true
  readonly stem: string
  readonly path: string
  readonly closed: readonly string[]
  readonly alreadyClosed: readonly string[]
}

export type CloseOutcome = OutcomesClosed | RecordRefused

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
 * Places the `Pull request:` line under the origin lines the task already
 * carries. A task shipped in slices lists every pull request, so a new number
 * appends to an existing line rather than replacing it, and a line that does
 * not read as a list is replaced whole. A task with no origin line takes it
 * under the H1, which is the only other anchor the board format guarantees.
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

function lastOriginLine(lines: readonly string[]): number | undefined {
  let found: number | undefined

  for (const [index, line] of lines.entries()) {
    if (ORIGIN_PREFIXES.some((prefix) => line.startsWith(prefix))) found = index
  }

  return found
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
 * when the line exists, since a task runs under one plan. `Plan:` is the first
 * origin line a task carries, so it anchors on the heading itself rather than
 * on the last origin line above it.
 *
 * A line already linking several plans is refused whole, even when one of them
 * is the target, since overwriting it drops links the caller never named and
 * reporting it unchanged hides a line that breaks the one-plan rule.
 */
export function writePlanLine(text: string, target: string): PlanLineWrite {
  const line = planLine(target)
  const lines = text.split('\n')
  const existing = planLineIndex(lines)

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
 * which is the order the board format writes them. A caller reads the file
 * before deciding, so a position is what it already holds, while a text match
 * would need the wording handed back exactly.
 */
export function closeOutcomeLines(
  text: string,
  positions: readonly number[],
): {
  readonly text: string
  readonly closed: readonly string[]
  readonly alreadyClosed: readonly string[]
  readonly total: number
} {
  const wanted = new Set(positions)
  const closed: string[] = []
  const alreadyClosed: string[] = []
  const lines = text.split('\n')
  const fenced = fenceMask(lines)
  let seen = 0

  const rewritten = lines.map((line, index) => {
    if (fenced[index]) return line

    const match = OUTCOME_PATTERN.exec(line)
    if (!match) return line

    seen += 1
    if (!wanted.has(seen)) return line

    const [, box, body] = match
    if (box !== ' ') {
      alreadyClosed.push(body.trim())
      return line
    }

    closed.push(body.trim())
    return body ? `- [x] ${body}` : '- [x]'
  })

  return { text: rewritten.join('\n'), closed, alreadyClosed, total: seen }
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

async function openTask(
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
 * Records a pull request number on the task the branch closes. `git-pr` runs
 * this from a linked worktree, where an in-place edit through the file-editing
 * tools is refused and a shell stream editor is banned, so the write has to
 * resolve the board root in-process.
 */
export async function recordPullRequest(
  root: string,
  selector: RecordSelector,
  number: number,
): Promise<PullRequestOutcome> {
  const opened = await openTask(root, selector)
  if ('ok' in opened) return opened

  const { stem, path } = opened
  const { text, action } = writePullRequestLine(
    await readFile(path, 'utf8'),
    number,
  )

  if (action !== 'unchanged') await writeFile(path, text)

  return { ok: true, stem, path, number, action }
}

/**
 * Records a plan's path on the task it belongs to, as the task's `Plan:` line.
 * `plan-feature` runs this right after the plan file lands, resolving the
 * reference the same two ways `canon tasks plan-answers` does, through
 * `planCandidates`, so a bare slug and a board-relative path both resolve.
 *
 * The task is named directly rather than through `RecordSelector`'s `plan`
 * kind: every caller already holds the stem, since resolving the task is what
 * put it in a position to write the plan's path in the first place.
 */
export async function recordPlan(
  root: string,
  stem: string,
  reference: string,
): Promise<PlanOutcome> {
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
  const written = writePlanLine(await readFile(path, 'utf8'), target)

  if (!written.ok) {
    return refuse(
      'several-plans',
      `${opened.stem} already links ${written.targets.length} plans on its Plan: line, so plan-link cannot tell which one to replace. Edit the line by hand to name one plan.`,
      written.targets,
    )
  }

  const { text, action, replaced } = written
  if (action !== 'unchanged') await writeFile(path, text)

  return { ok: true, stem: opened.stem, path, plan: target, action, replaced }
}

/**
 * Marks the named outcomes `[x]` in place. `context-fold` runs this against a
 * board it can read and cannot edit from a linked worktree, and the positions
 * come from the read it already made.
 */
export async function closeOutcomes(
  root: string,
  selector: RecordSelector,
  positions: readonly number[],
): Promise<CloseOutcome> {
  const opened = await openTask(root, selector)
  if ('ok' in opened) return opened

  const { stem, path } = opened
  const result = closeOutcomeLines(await readFile(path, 'utf8'), positions)

  if (result.total === 0) {
    return refuse('no-outcomes', `${stem} carries no outcomes to close.`)
  }

  const beyond = positions.filter(
    (position) => position < 1 || position > result.total,
  )

  if (beyond.length > 0) {
    return refuse(
      'out-of-range',
      `${stem} carries ${result.total} outcome(s), so ${beyond.join(', ')} names nothing.`,
      beyond.map(String),
    )
  }

  if (result.closed.length > 0) await writeFile(path, result.text)

  return {
    ok: true,
    stem,
    path,
    closed: result.closed,
    alreadyClosed: result.alreadyClosed,
  }
}
