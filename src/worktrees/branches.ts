import { $ } from 'bun'
import { gitEnv } from '@/git/env'
import type { ResolvedSession } from '@/sessions/resolve'
import type { MergedPullRequest } from '@/worktrees/reclaim'

/** Why one worktree-less local branch is kept, one entry per failing condition. */
export type BranchRefusal =
  | 'trunk'
  | 'held-by-session'
  | 'no-merged-pull-request'
  | 'not-in-merged-head'
  | 'head-unreadable'

export interface BranchVerdict {
  readonly branch: string
  /** The commit the branch pointed at when read, printed so a deleted branch can be restored by hand. */
  readonly tip: string
  readonly reclaimable: boolean
  readonly refusals: readonly BranchRefusal[]
  /**
   * The merged pull request whose head contains the tip, or the newest one
   * merged under the name when none does. Null when the name never merged.
   */
  readonly pullRequest: number | null
}

export type BranchReport =
  | { readonly kind: 'read'; readonly branches: readonly BranchVerdict[] }
  | { readonly kind: 'unreadable'; readonly detail: string }

export interface BranchInput {
  readonly cwd: string
  /** Every branch a worktree holds, the main worktree's included. None of them is a candidate. */
  readonly worktreeBranches: ReadonlySet<string>
  /** Newest first, as `gh pr list` returns them. */
  readonly merged: readonly MergedPullRequest[]
  readonly sessions: readonly ResolvedSession[]
  readonly repository: string | null
}

const TRUNKS = new Set(['main', 'master'])

type Containment = 'contained' | 'outside' | 'unreadable'

/**
 * Lists every local branch with its tip, or says the listing failed.
 *
 * `lstrip=2` rather than `short`, since `short` abbreviates a name that is
 * ambiguous with a tag or a remote ref and the delete would then name a
 * different ref than the one judged.
 */
async function localBranches(
  cwd: string,
): Promise<{ branch: string; tip: string }[] | string> {
  const result =
    await $`git -C ${cwd} for-each-ref --format=${'%(refname:lstrip=2)%09%(objectname)'} refs/heads/`
      .env(gitEnv())
      .quiet()
      .nothrow()
  if (result.exitCode !== 0) {
    return result.stderr.toString().trim() || 'git for-each-ref failed.'
  }

  return result.stdout
    .toString()
    .split('\n')
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const [branch, tip] = line.split('\t')
      return branch && tip ? [{ branch, tip }] : []
    })
}

/** The branch `origin/HEAD` names, or null when no remote head is set. */
async function remoteTrunk(cwd: string): Promise<string | null> {
  const result =
    await $`git -C ${cwd} symbolic-ref --quiet refs/remotes/origin/HEAD`
      .env(gitEnv())
      .quiet()
      .nothrow()
  if (result.exitCode !== 0) return null
  return result.stdout
    .toString()
    .trim()
    .replace(/^refs\/remotes\/origin\//, '')
}

/**
 * Whether `tip` is contained in `head`.
 *
 * `--is-ancestor` exits 1 for "no" and 128 when either object is absent, and
 * only the first is an answer. Reading 128 as "no" is safe but misnames the
 * reason, and reading it as "yes" deletes a branch on a head nobody could see.
 */
async function containment(
  cwd: string,
  tip: string,
  head: string | undefined,
): Promise<Containment> {
  if (head === undefined) return 'unreadable'
  const result = await $`git -C ${cwd} merge-base --is-ancestor ${tip} ${head}`
    .env(gitEnv())
    .quiet()
    .nothrow()
  if (result.exitCode === 0) return 'contained'
  if (result.exitCode === 1) return 'outside'
  return 'unreadable'
}

async function verdict(
  cwd: string,
  branch: string,
  tip: string,
  trunks: ReadonlySet<string>,
  held: boolean,
  merged: readonly MergedPullRequest[],
): Promise<BranchVerdict> {
  const refusals: BranchRefusal[] = []
  if (trunks.has(branch)) refusals.push('trunk')
  if (held) refusals.push('held-by-session')

  let pullRequest = merged[0]?.number ?? null
  if (merged.length === 0) {
    refusals.push('no-merged-pull-request')
  } else {
    // Every merged head for the name, since a name merged twice can match the
    // older pull request while its tip moved on past the newer one.
    const answers = await Promise.all(
      merged.map((request) => containment(cwd, tip, request.headOid)),
    )
    const hit = answers.indexOf('contained')
    if (hit >= 0) pullRequest = merged[hit]?.number ?? pullRequest
    else if (answers.includes('unreadable')) refusals.push('head-unreadable')
    else refusals.push('not-in-merged-head')
  }

  return {
    branch,
    tip,
    reclaimable: refusals.length === 0,
    refusals,
    pullRequest,
  }
}

/**
 * Reports which local branches no worktree holds are safe to delete.
 *
 * Safe means the tip is contained in the head of a merged pull request for
 * that name, so every commit on the branch reached the remote under a merge.
 * Containment rather than a matching name or number, since a reused name
 * carrying a commit past its merged head would otherwise lose that commit, and
 * rather than ancestry to the trunk, which a squash merge never produces.
 *
 * A listing that fails refuses the whole reading, since it answers with the
 * same empty list as a repository with nothing to delete.
 */
export async function branchReport(input: BranchInput): Promise<BranchReport> {
  const [listing, remote] = await Promise.all([
    localBranches(input.cwd),
    remoteTrunk(input.cwd),
  ])
  if (typeof listing === 'string')
    return { kind: 'unreadable', detail: listing }

  const trunks = new Set(TRUNKS)
  if (remote !== null) trunks.add(remote)

  const byName = new Map<string, MergedPullRequest[]>()
  for (const request of input.merged) {
    const list = byName.get(request.branch) ?? []
    list.push(request)
    byName.set(request.branch, list)
  }

  const heldBySession = new Set(
    input.sessions
      .filter((session) => session.repository === input.repository)
      .flatMap((session) => (session.branch === null ? [] : [session.branch])),
  )

  const candidates = listing.filter(
    ({ branch }) => !input.worktreeBranches.has(branch),
  )
  const branches = await Promise.all(
    candidates.map(({ branch, tip }) =>
      verdict(
        input.cwd,
        branch,
        tip,
        trunks,
        heldBySession.has(branch),
        byName.get(branch) ?? [],
      ),
    ),
  )

  return { kind: 'read', branches }
}
