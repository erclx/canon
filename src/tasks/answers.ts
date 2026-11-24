import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, isAbsolute, relative, resolve } from 'node:path'
import { branchRefs } from '@/git/worktree'
import { fanInBranch, fanInFindings, readFanInMembers } from '@/tasks/fan-in'
import { isUnder } from '@/tasks/paths'
import {
  JUDGED_APART_REMEDY,
  readLivePlans,
  type StackPlan,
  stackPairs,
} from '@/tasks/stack'
import { linesOutsideFences } from '@/markdown/scan'
import { recordDir, recordDirs } from '@/roots/record'
import {
  hasStagedBatches,
  normalizeOperatorCall,
  OPERATOR_CALL,
  readQuestions,
  splitPlanSections,
} from '@/records/validate'

const PLANS = 'plans'
const TASKS = 'tasks'
const ARCHIVE = 'archive'

const SUGGESTED_PREFIX = '- Suggested:'
const ANSWER_PREFIX = '- Answer:'
const APPROVED_PREFIX = 'Approved:'

/** The refusals resolving a reference can return, which every plan verb shares. */
export const RESOLVE_REFUSALS = ['no-plan', 'archived', 'bad-input'] as const

export type ResolveRefusal = (typeof RESOLVE_REFUSALS)[number]

/** The refusals the gate returns, which are a resolve's alone. */
export const ANSWER_REFUSALS = RESOLVE_REFUSALS

export type AnswerRefusal = (typeof ANSWER_REFUSALS)[number]

export interface AnswersRefused<R extends AnswerRefusal = ResolveRefusal> {
  readonly ok: false
  readonly reason: R
  readonly message: string
  readonly detail: readonly string[]
}

/**
 * One question the dispatch has to hand back. It carries the label rather than
 * contributing to a count, since a dispatcher that refuses a row without naming
 * the slot has nothing to give the operator.
 */
export interface OpenQuestion {
  readonly label: string
  readonly why: string
}

/**
 * `approved` is the text after the plan's `Approved:` line, or null without
 * one. `deferred` lists each untyped operator call that line closed, being the
 * values the build still has to ask for, so it is empty without an approval.
 */
export interface PlanAnswers {
  readonly ok: true
  readonly plan: string
  readonly launchable: boolean
  readonly open: readonly OpenQuestion[]
  readonly approved: string | null
  readonly deferred: readonly OpenQuestion[]
}

export type AnswersOutcome = PlanAnswers | AnswersRefused<AnswerRefusal>

/**
 * Whether `refs/remotes/origin/<branch>` exists, or `null` when the read
 * itself failed. Injected so the gate is testable without a repository.
 */
export type RemoteBranchReader = (
  root: string,
  branch: string,
) => Promise<boolean | null>

/**
 * Reads the remote-tracking ref as the last fetch left it, so a member pushed
 * since then reads as absent and holds its integrator, which fails safe. The
 * local head is not read, since it exists mid-build.
 */
export const originBranchPushed: RemoteBranchReader = async (root, branch) => {
  const report = await branchRefs(branch, root)
  if (!report.readable) return null

  return report.refs.includes(`refs/remotes/origin/${branch}`)
}

/**
 * A reference that named a live plan, carrying the absolute path a reader opens
 * and the root-relative spelling a record reports.
 */
export interface PlanResolved {
  readonly ok: true
  readonly path: string
  readonly plan: string
}

export type ResolveOutcome = PlanResolved | AnswersRefused

/**
 * The spellings a caller reaches a plan by, in the order tried. A bare slug
 * names the live folder, and a path resolves against the project root and then
 * the board directory, since a board link is relative to `.canon/tasks/`.
 */
export function planCandidates(root: string, reference: string): string[] {
  if (reference.includes('/') || reference.endsWith('.md')) {
    if (isAbsolute(reference)) return [reference]

    return [
      resolve(root, reference),
      resolve(recordDir(root, TASKS), reference),
    ]
  }

  const slug = reference.startsWith('feature-')
    ? reference.slice('feature-'.length)
    : reference

  return [recordDir(root, PLANS, `feature-${slug}.md`)]
}

function suggestionOf(body: readonly string[]): string | undefined {
  const line = body.find((entry) => entry.startsWith(SUGGESTED_PREFIX))

  return line?.slice(SUGGESTED_PREFIX.length).trim()
}

/**
 * An absent `- Answer:` line reads the same as a blank one here, since a missing
 * slot is a conformance defect `canon tasks validate` already names, and a gate
 * answering it differently would refuse a row for a reason already reported.
 */
function isAnswered(body: readonly string[]): boolean {
  const line = body.find((entry) => entry.startsWith(ANSWER_PREFIX))
  if (line === undefined) return false

  return line.slice(ANSWER_PREFIX.length).trim().length > 0
}

/**
 * The reason follows a comma or a full stop, so both separators come off and
 * the operator gets no stray mark. It takes the normalized suggestion, since
 * slicing by the canonical length against the raw text would cut the reason.
 */
function reasonOf(normalized: string): string {
  const rest = normalized.slice(OPERATOR_CALL.length).replace(/^[,.;:\s]+/, '')

  return rest.length > 0 ? rest : 'no reason stated'
}

/**
 * A question carrying no suggestion is also a stop at execution, and is not
 * read here. `checkQuestionContract` reports it as `suggestion-missing`, and
 * testing it again would put one rule in two places on different cadences.
 */
function operatorCalls(lines: readonly string[]): OpenQuestion[] {
  const open: OpenQuestion[] = []

  for (const question of readQuestions(lines)) {
    const suggested = suggestionOf(question.body)
    if (!suggested) continue

    const normalized = normalizeOperatorCall(suggested)
    if (!normalized.toLowerCase().startsWith(OPERATOR_CALL)) continue
    if (isAnswered(question.body)) continue

    open.push({ label: question.label, why: reasonOf(normalized) })
  }

  return open
}

/**
 * The approval sits under the H1 paragraph, ahead of the first section, since
 * the answer contract keeps a planner out of `## Questions`. A line anywhere
 * later reads as prose quoting the form rather than as an approval.
 */
export function readApproval(text: string): string | null {
  for (const line of linesOutsideFences(text)) {
    const trimmed = line.trim()
    if (/^(?:#{2,}\s|\*\*)/.test(trimmed)) return null
    if (!trimmed.startsWith(APPROVED_PREFIX)) continue

    const value = trimmed.slice(APPROVED_PREFIX.length).trim()
    return value.length > 0 ? value : null
  }

  return null
}

/**
 * Resolves a caller's reference to a live plan, refusing an empty reference, a
 * reference that names no file, and one in the plans archive. `planAnswers` and
 * `planBranch` share it so the ladder lives once.
 */
export function resolvePlanReference(
  root: string,
  reference: string,
): ResolveOutcome {
  if (reference.trim().length === 0) {
    return refuse('bad-input', 'No plan named. Pass a plan path or its slug.')
  }

  const candidates = planCandidates(root, reference)
  const path = candidates.find((candidate) => existsSync(candidate))

  if (!path) {
    // Naming every base keeps a task-relative link from reporting only the one that fails.
    const looked = candidates.map((entry) => relative(root, entry)).join(' or ')

    return refuse('no-plan', `No plan at ${looked}.`, [reference])
  }

  // An archived plan answers every question and would clear a dispatch `auto-ship` refuses.
  if (recordDirs(root, PLANS, ARCHIVE).some((dir) => isUnder(path, dir))) {
    return refuse(
      'archived',
      `${relative(root, path)} sits in the plans archive, so it describes work that already shipped.`,
      [reference],
    )
  }

  return { ok: true, path, plan: relative(root, path) }
}

/**
 * Answers whether a plan is launchable, being whether it still waits on the
 * operator. It reads the questions through the validator's own `readQuestions`
 * so the two cannot drift, and reports and never writes; the dispatcher holds.
 */
export async function planAnswers(
  root: string,
  reference: string,
  readRemoteBranch: RemoteBranchReader = originBranchPushed,
): Promise<AnswersOutcome> {
  const resolved = resolvePlanReference(root, reference)
  if (!resolved.ok) return resolved

  const text = await readFile(resolved.path, 'utf8')
  const approved = readApproval(text)

  const sections = splitPlanSections(text)
  const calls = operatorCalls(sections.get('Questions') ?? [])
  const deferred = approved === null ? [] : calls
  const open = approved === null ? calls : []

  if (hasStagedBatches(text)) {
    open.push({
      label: 'Batch staging',
      why: 'stages a batch inside one file and must split into one plan file per batch before it can dispatch.',
    })
  }

  const stem = basename(resolved.path, '.md')
  const live = await readLivePlans(root)
  const pairs = stackPairs(live)

  for (const { child, parent, shared } of pairs) {
    if (child !== stem) continue

    open.push({
      label: 'Stacked sibling',
      why: `stacks on \`${parent}\` and shares ${shared} declared files with it. ${JUDGED_APART_REMEDY}`,
    })
  }

  open.push(...(await fanInEntries(root, stem, text, live, readRemoteBranch)))

  return {
    ok: true,
    plan: resolved.plan,
    launchable: open.length === 0,
    open,
    approved,
    deferred,
  }
}

/**
 * A plan whose fan-in set disagrees holds on `Fan-in set`, on either side, since
 * an archived member's leftover branch would read as done. An agreeing
 * integrator holds on `Fan-in pending` until every member branch is on origin.
 */
async function fanInEntries(
  root: string,
  stem: string,
  text: string,
  live: readonly StackPlan[],
  readRemoteBranch: RemoteBranchReader,
): Promise<OpenQuestion[]> {
  const entries: OpenQuestion[] = fanInFindings(live)
    .filter(({ record }) => record === `${stem}.md`)
    .map(({ message }) => ({ label: 'Fan-in set', why: message }))

  const branches = readFanInMembers(text).map(fanInBranch)
  if (branches.length === 0 || entries.length > 0) return entries

  const pushed = await Promise.all(
    branches.map((branch) => readRemoteBranch(root, branch)),
  )

  if (pushed.includes(null)) {
    return [
      {
        label: 'Fan-in pending',
        why: 'git could not read the member branches on origin, so the set is unread rather than done.',
      },
    ]
  }

  const absent = branches.filter((_, index) => pushed[index] !== true)
  if (absent.length === 0) return []

  return [
    {
      label: 'Fan-in pending',
      why: `waits on ${absent.map((branch) => `\`${branch}\``).join(', ')} reaching origin. Fetch, then read again.`,
    },
  ]
}

function refuse<R extends AnswerRefusal>(
  reason: R,
  message: string,
  detail: readonly string[] = [],
): AnswersRefused<R> {
  return { ok: false, reason, message, detail }
}
