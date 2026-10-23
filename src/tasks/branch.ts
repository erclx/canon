import { basename } from 'node:path'
import { type AnswersRefused, resolvePlanReference } from '@/tasks/answers'

const PLAN_PREFIX = 'feature-'
const MARKDOWN = '.md'

/**
 * The type every plan-derived branch takes. It is a constant rather than a
 * reading, because determinism is the whole property that makes the dispatch
 * gate and the worker agree, and prose reading is the judgment that produced
 * three strings for one plan. A wrong type is cheap because a branch type is
 * cosmetic, since a commit's type and a pull request's title are both read off
 * the diff. Nothing renames it later, whatever three shipped bodies used to say.
 */
export const PLAN_BRANCH_TYPE = 'feat'

/** The description cap in `claude/skills/git-branch/references/branch.md`, in kebab-separated words. */
export const DESCRIPTION_WORD_CAP = 4

/** The branch length cap in `claude/skills/git-branch/references/branch.md`, in characters. */
export const BRANCH_LENGTH_CAP = 50

export interface PlanBranch {
  readonly ok: true
  readonly plan: string
  readonly type: string
  readonly slug: string
  readonly branch: string
  readonly words: number
  readonly conforms: boolean
}

export type BranchOutcome = PlanBranch | AnswersRefused

/**
 * Takes the slug off a plan filename. The `feature-` prefix and the extension
 * are the two things every plan filename carries and no branch name does, so
 * both come off and whatever is left is the description.
 */
function slugOf(path: string): string {
  const stem = basename(path, MARKDOWN)

  return stem.startsWith(PLAN_PREFIX) ? stem.slice(PLAN_PREFIX.length) : stem
}

/** The branch a plan file derives, from its filename alone. */
export function branchOfPlan(path: string): string {
  return `${PLAN_BRANCH_TYPE}/${slugOf(path)}`
}

/**
 * Derives the branch a dispatch checks and a worker takes, from the plan both
 * of them name. It is the one derivation, so the collision check and the
 * worktree entry it gates cannot hold two answers for one plan.
 *
 * Conformance covers both caps `claude/skills/git-branch/references/branch.md` states, being the word
 * count of the description and the length of the whole branch. A slug is a
 * plan's own filename rather than a name anyone chose for a branch, so a plan
 * can name a branch this refuses to grade as conforming, and reporting that is
 * the point: the caller hands the row to a person rather than shipping a
 * rename that parts the branch slug from the plan slug.
 */
export function planBranch(root: string, reference: string): BranchOutcome {
  const resolved = resolvePlanReference(root, reference)
  if (!resolved.ok) return resolved

  const slug = slugOf(resolved.path)
  const branch = branchOfPlan(resolved.path)
  const words = slug.split('-').filter((word) => word.length > 0).length

  return {
    ok: true,
    plan: resolved.plan,
    type: PLAN_BRANCH_TYPE,
    slug,
    branch,
    words,
    conforms:
      words > 0 &&
      words <= DESCRIPTION_WORD_CAP &&
      branch.length <= BRANCH_LENGTH_CAP,
  }
}
