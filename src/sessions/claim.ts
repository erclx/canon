import {
  repositoryOf,
  resolveSessions,
  type ResolvedSession,
  type SessionReport,
} from '@/sessions/resolve'
import {
  branchRefs,
  listWorktrees,
  type RefReport,
  type WorktreeEntry,
} from '@/git/worktree'

export interface ClaimReport {
  readonly claimed: boolean
  readonly worktree: string | null
  readonly sessions: readonly ResolvedSession[]
  /** The refs already naming the branch, local head and `origin` remote-tracking alike. */
  readonly refs: readonly string[]
  /** False when the session roster could not be read, so `claimed` covers the readings around it alone and cannot be trusted as a clean "unclaimed". */
  readonly sessionsReadable: boolean
  /** False when the ref read failed, which is the same false clean under a different reading. */
  readonly refsReadable: boolean
}

export interface ClaimOptions {
  /**
   * The repository the claim is answered about, not merely where the caller
   * stands. Every reading below is taken against it, so handing another
   * project's path asks about that project, which is what lets a dispatcher in
   * one repository see a branch held in another. Defaults to the caller's own
   * directory, so a call omitting it answers exactly as it always has.
   */
  readonly cwd?: string
  readonly resolve?: () => Promise<SessionReport>
  readonly listWorktrees?: (cwd: string) => Promise<readonly WorktreeEntry[]>
  readonly branchRefs?: (branch: string, cwd: string) => Promise<RefReport>
}

/**
 * Answers whether a branch is already claimed, composing the three readings no
 * one surface can answer alone: a worktree can outlive the session that made
 * it, a session can hold a branch before a worktree exists for it, and a branch
 * behind a merged pull request has neither while still being taken.
 *
 * The two readable flags stay separate because a caller told the roster failed
 * looks at the roster. Folding either into `claimed` would report the failure
 * as a clean "unclaimed", which is the answer this exists to stop giving.
 */
export async function checkClaim(
  branch: string,
  opts: ClaimOptions = {},
): Promise<ClaimReport> {
  const cwd = opts.cwd ?? process.cwd()
  const resolve = opts.resolve ?? resolveSessions
  const listAll = opts.listWorktrees ?? listWorktrees
  const readRefs = opts.branchRefs ?? branchRefs

  const [repository, worktrees, report, refs] = await Promise.all([
    repositoryOf(cwd),
    listAll(cwd),
    resolve(),
    readRefs(branch, cwd),
  ])

  const worktree =
    worktrees.find((entry) => entry.branch === branch)?.path ?? null

  const sessions =
    report.kind === 'resolved'
      ? report.sessions.filter(
          (session) =>
            session.branch === branch && session.repository === repository,
        )
      : []

  return {
    claimed: worktree !== null || sessions.length > 0 || refs.refs.length > 0,
    worktree,
    sessions,
    refs: refs.refs,
    sessionsReadable: report.kind === 'resolved',
    refsReadable: refs.readable,
  }
}
