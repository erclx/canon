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
  /**
   * Foreign-namespace records whose socket is gone. They read dead, so a branch
   * one of them holds can read unclaimed, which a caller with a count above
   * zero should treat as unverified.
   */
  readonly foreignDead: number
  /** False when the ref read failed, which is the same false clean under a different reading. */
  readonly refsReadable: boolean
}

export interface ClaimOptions {
  /**
   * The repository the claim is answered about, not merely where the caller
   * stands, so handing another project's path lets a dispatcher see a branch
   * held there. Defaults to the caller's own directory.
   */
  readonly cwd?: string
  readonly resolve?: () => Promise<SessionReport>
  readonly listWorktrees?: (cwd: string) => Promise<readonly WorktreeEntry[]>
  readonly branchRefs?: (branch: string, cwd: string) => Promise<RefReport>
}

/**
 * Answers whether a branch is already claimed, composing three readings: a
 * worktree can outlive its session, a session can hold a branch before a
 * worktree exists, and a merged pull request's branch has neither.
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
    foreignDead: report.kind === 'resolved' ? report.foreignDead : 0,
    refsReadable: refs.readable,
  }
}
