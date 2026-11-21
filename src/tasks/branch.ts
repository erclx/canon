import { basename } from 'node:path'
import { type AnswersRefused, resolvePlanReference } from '@/tasks/answers'

const PLAN_PREFIX = 'feature-'
const MARKDOWN = '.md'

/**
 * The type every plan-derived branch takes, a constant rather than a reading,
 * since determinism is what makes the dispatch gate and the worker agree. A
 * wrong type is cosmetic, since commit and pull request types come off the diff.
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
 * name. A slug is a plan's filename, so a plan can name a branch that breaks
 * a cap in `git-branch`'s `branch.md`, and that is reported, not renamed.
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
