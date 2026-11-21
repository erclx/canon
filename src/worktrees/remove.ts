import { $ } from 'bun'
import { gitEnv } from '@/git/env'
import type { BranchVerdict } from '@/worktrees/branches'
import type { WorktreeVerdict } from '@/worktrees/reclaim'

/** Which half of the removal a failure landed on, so a reader repairs the right one. */
export type RemovalStep = 'remove' | 'branch'

export interface RemovalOutcome {
  readonly path: string
  readonly branch: string | null
  readonly removed: boolean
  /** Null on success, so a reader branches on the step rather than on a message. */
  readonly failedAt: RemovalStep | null
  readonly detail: string | null
}

export interface RemovalReport {
  readonly outcomes: readonly RemovalOutcome[]
  /** True when the stale-registration sweep ran, which only a missing directory owes. */
  readonly pruned: boolean
}

export interface GitResult {
  readonly exitCode: number
  readonly stderr: string
}

export interface RemovalOptions {
  /**
   * Where every git call runs. Required rather than defaulted, since the only
   * default available is the process directory, and a caller standing in a
   * worktree this run removes would lose the ground later calls resolve against.
   */
  readonly cwd: string
  readonly git?: (cwd: string, args: readonly string[]) => Promise<GitResult>
}

async function runGit(
  cwd: string,
  args: readonly string[],
): Promise<GitResult> {
  const result = await $`git -C ${cwd} ${args}`.env(gitEnv()).quiet().nothrow()

  return {
    exitCode: result.exitCode,
    stderr: result.stderr.toString().trim(),
  }
}

/**
 * Removes every worktree a reading called reclaimable, and its branch: unlock,
 * remove, delete, from `opts.cwd` at the main root, since a removal can delete
 * the caller's directory. One `prune` runs before the deletes, which a held branch blocks.
 */
export async function removeReclaimable(
  verdicts: readonly WorktreeVerdict[],
  opts: RemovalOptions,
): Promise<RemovalReport> {
  const { cwd } = opts
  const git = opts.git ?? runGit
  const targets = verdicts.filter((entry) => entry.reclaimable)

  const removals: { target: WorktreeVerdict; result: GitResult }[] = []
  for (const target of targets) {
    await git(cwd, ['worktree', 'unlock', target.path])
    removals.push({
      target,
      result: await git(cwd, ['worktree', 'remove', target.path]),
    })
  }

  // Reported from the sweep's own exit, so a failed run does not read as one that cleared the tree.
  const sweep = targets.some((target) => target.missing)
    ? await git(cwd, ['worktree', 'prune'])
    : null
  const pruned = sweep !== null && sweep.exitCode === 0

  const outcomes: RemovalOutcome[] = []
  for (const { target, result } of removals) {
    outcomes.push(await deleteBranch(target, result, cwd, git))
  }

  return { outcomes, pruned }
}

/**
 * Closes one entry by deleting its branch, or reports why it was left standing.
 * A failed remove against a directory that still exists stops here, since git
 * refuses a held branch and forcing would strand a registration; a missing one carries on.
 */
async function deleteBranch(
  target: WorktreeVerdict,
  removal: GitResult,
  cwd: string,
  git: (cwd: string, args: readonly string[]) => Promise<GitResult>,
): Promise<RemovalOutcome> {
  const { path, branch } = target

  if (removal.exitCode !== 0 && !target.missing) {
    return {
      path,
      branch,
      removed: false,
      failedAt: 'remove',
      detail: removal.stderr || null,
    }
  }

  // A reclaimable verdict always names a branch, so this answers a caller passing its own verdict.
  if (branch === null) {
    return { path, branch, removed: true, failedAt: null, detail: null }
  }

  const deleted = await git(cwd, ['branch', '-D', branch])
  if (deleted.exitCode !== 0) {
    return {
      path,
      branch,
      removed: false,
      failedAt: 'branch',
      detail: deleted.stderr || null,
    }
  }

  return { path, branch, removed: true, failedAt: null, detail: null }
}

export interface BranchOutcome {
  readonly branch: string
  /** The tip the delete took, so a reader can restore the branch with `git branch <name> <tip>`. */
  readonly tip: string
  readonly pullRequest: number | null
  readonly removed: boolean
  readonly detail: string | null
}

/**
 * Deletes every branch a reading called reclaimable, from `opts.cwd`. `-D` rather
 * than `-d`, since a squash merge never makes the branch an ancestor and the
 * reading's containment test stands in. Git still refuses a branch checked out since.
 */
export async function removeBranches(
  verdicts: readonly BranchVerdict[],
  opts: RemovalOptions,
): Promise<BranchOutcome[]> {
  const git = opts.git ?? runGit
  const outcomes: BranchOutcome[] = []

  for (const { branch, tip, pullRequest, reclaimable } of verdicts) {
    if (!reclaimable) continue
    const result = await git(opts.cwd, ['branch', '-D', branch])
    outcomes.push({
      branch,
      tip,
      pullRequest,
      removed: result.exitCode === 0,
      detail: result.exitCode === 0 ? null : result.stderr || null,
    })
  }

  return outcomes
}
