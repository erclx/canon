import { $ } from 'bun'
import { gitEnv } from '@/git/env'
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
   * Where every git call runs. Required rather than defaulted, since the one
   * value a default could carry is the process directory and that is the unsafe
   * one: a caller standing in a worktree this run removes loses the ground the
   * calls after it resolve against. A compiler error is what a caller gets
   * instead of that failure.
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
 * Removes every worktree a reading called reclaimable, and the branch behind it.
 *
 * The sequence is unlock, remove, then delete the branch, and it is the same
 * whether the directory still exists or is already gone. `git worktree remove`
 * takes a stale registration as readily as a live directory, measured at git
 * 2.43.0, so the missing case needs no command of its own.
 *
 * Every command runs from `opts.cwd`, which belongs at the main worktree root
 * and never at the directory a caller happens to stand in. A removal earlier in
 * the run deletes that directory, and each `git -C` after it fails against a
 * path that is gone, so the branches behind those entries survive and the run
 * reports the failures against the worktrees rather than against the removal
 * that pulled the ground out.
 *
 * The unlock runs on every entry and its result is not read, since `git worktree
 * unlock` exits 128 with "is not locked" for the ordinary case. Reading the lock
 * state first would buy a second parse of the porcelain to answer what the next
 * command answers anyway, and a lock that genuinely refuses to lift surfaces as
 * the remove failing rather than being swallowed.
 *
 * `git worktree prune` sweeps once after the removals rather than per entry,
 * because it clears every stale registration in one pass and takes no path to
 * scope it. It runs ahead of the branch deletes rather than at the very end: a
 * branch git still reads as held by a worktree cannot be deleted, and a sweep
 * placed after that pass would leave the branch standing with nothing left in
 * the listing to find it by.
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

  // Reported from the sweep's own exit rather than from whether it was owed, so
  // a run that tried and failed does not read as one that cleared the tree.
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
 *
 * A remove that failed against a directory which still exists stops the entry
 * here. Git refuses to delete a branch a registered worktree holds, and forcing
 * past that strands a registration pointing at a branch that no longer exists.
 * A missing directory carries on, since the sweep above is what clears the
 * registration in that case and the delete reports for itself when it did not.
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

  // A reclaimable verdict always names a branch, since a detached head is one of
  // the refusals. The read is here so a caller passing a verdict of its own is
  // answered rather than handed a delete with no name in it.
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
