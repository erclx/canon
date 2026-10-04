import { $ } from 'bun'
import { execa } from 'execa'
import { existsSync } from 'node:fs'
import { gitEnv } from '@/git/env'
import {
  repositoryOf,
  type ResolvedSession,
  resolveSessions,
  type SessionReport,
} from '@/sessions/resolve'
import {
  currentWorktreeRoot,
  listWorktrees,
  type WorktreeEntry,
} from '@/git/worktree'

const GH_TIMEOUT_MS = 30_000

/** A local binary read, not a network round trip, so the bound is tighter. */
const CLAUDE_AGENTS_TIMEOUT_MS = 10_000

/**
 * How many merged pull requests one read covers. A worktree older than this
 * many merges reads as having none and is refused, which is the safe direction:
 * the failure keeps a directory rather than removing one.
 */
const MERGED_LIMIT = 200

/** Why one worktree cannot be reclaimed, one entry per failing condition. */
export type Refusal =
  | 'main-worktree'
  | 'current-worktree'
  | 'detached-head'
  | 'no-merged-pull-request'
  | 'uncommitted-changes'
  | 'unreadable-worktree'
  | 'held-by-session'

/** Why the whole reading was refused, so no verdict was produced at all. */
export type Unreadable = 'gh-missing' | 'gh-failed' | 'sessions-unreadable'

/**
 * Which removal shape applies. `session` removes the background session and its
 * worktree together, and `worktree` removes a directory whose session has
 * ended. Picking the wrong one strands state, so this is reported rather than
 * assumed.
 */
export type Route = 'session' | 'worktree'

/** No removal shape reaches the main worktree, which is what `null` says. */
export type RemovalRoute = Route | null

/**
 * One live session holding a worktree, enriched with the id `claude rm` takes.
 *
 * `id` is null on two occasions a caller cannot tell apart from the name
 * alone: an interactive holder, which carries no id at all since nothing but a
 * person closing its terminal removes it, and a background holder whose id
 * `claude agents --json` could not resolve, whether the binary is missing,
 * failing, or simply has not reported that pid.
 */
export interface HeldSession {
  readonly name: string
  readonly kind: string
  readonly id: string | null
}

export interface WorktreeVerdict {
  readonly path: string
  readonly branch: string | null
  readonly reclaimable: boolean
  /** Every failing condition, so a reader sees what to fix rather than a bare refusal. */
  readonly refusals: readonly Refusal[]
  /** The pull request that retired the branch, so a report can name what it read. */
  readonly pullRequest: number | null
  /** The live sessions holding this worktree. */
  readonly sessions: readonly HeldSession[]
  readonly route: RemovalRoute
  /**
   * True when the directory is already gone and only the registration remains,
   * which is what decides whether a sweep is owed after the removals.
   */
  readonly missing: boolean
}

export interface MergedPullRequest {
  readonly branch: string
  readonly number: number
}

export type MergedReport =
  | { readonly kind: 'read'; readonly merged: readonly MergedPullRequest[] }
  | {
      readonly kind: 'unreadable'
      readonly reason: Extract<Unreadable, 'gh-missing' | 'gh-failed'>
      readonly detail: string
    }

export interface StatusReport {
  /** False when the status read itself failed, so a clean `dirty` says nothing. */
  readonly readable: boolean
  readonly dirty: boolean
  /**
   * True when no directory stands at the path. Readable and clean rather than
   * unreadable, since nothing is there to hold work.
   */
  readonly missing: boolean
}

export type ReclaimReport =
  | {
      readonly kind: 'unreadable'
      readonly reason: Unreadable
      readonly detail: string
    }
  | { readonly kind: 'read'; readonly worktrees: readonly WorktreeVerdict[] }

export interface ReclaimOptions {
  readonly cwd?: string
  readonly listWorktrees?: (cwd: string) => Promise<readonly WorktreeEntry[]>
  readonly mergedPullRequests?: (cwd: string) => Promise<MergedReport>
  readonly worktreeStatus?: (path: string) => Promise<StatusReport>
  readonly resolve?: () => Promise<SessionReport>
  readonly claudeAgentIds?: (
    cwd: string,
  ) => Promise<ReadonlyMap<number, string>>
}

/**
 * Reads the pull request state for the whole repository in one call.
 *
 * One call rather than one per worktree, since the per-worktree shape is a
 * network round trip inside a loop and the branches being matched are already
 * known before any of them runs.
 */
async function mergedPullRequests(cwd: string): Promise<MergedReport> {
  if (Bun.which('gh') === null) {
    return {
      kind: 'unreadable',
      reason: 'gh-missing',
      detail: 'gh is not on the path, so no merge state could be read.',
    }
  }

  const args = [
    'pr',
    'list',
    '--state',
    'merged',
    '--limit',
    String(MERGED_LIMIT),
    '--json',
    'headRefName,number',
  ]

  try {
    // `gh` resolves its repository through git, so it reads the same
    // resolution variables a hook exports and they take precedence over `cwd`.
    // A run from inside one would answer with another repository's merged
    // branches, and a branch name that recurs across repositories would then
    // match a merge that happened somewhere else and read a live worktree as
    // reclaimable, which is the unsafe direction on an unrecoverable removal.
    const result = await execa('gh', args, {
      cwd,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    })
    const rows = JSON.parse(result.stdout) as readonly {
      headRefName: string
      number: number
    }[]

    return {
      kind: 'read',
      merged: rows.map((row) => ({
        branch: row.headRefName,
        number: row.number,
      })),
    }
  } catch (error) {
    return {
      kind: 'unreadable',
      reason: 'gh-failed',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Reads every live agent's session id, keyed by its process id, from `claude
 * agents --json`.
 *
 * Guarded like `mergedPullRequests`, reading the same way, but degrading
 * rather than refusing: the id enriches a caller's report and is never an
 * input the reclaim logic depends on, where the merge state decides whether a
 * removal is safe at all. A missing or failing binary leaves every entry
 * unresolved instead of refusing the whole reading.
 */
async function claudeAgentIds(
  cwd: string,
): Promise<ReadonlyMap<number, string>> {
  if (Bun.which('claude') === null) return new Map()

  try {
    const result = await execa('claude', ['agents', '--json'], {
      cwd,
      timeout: CLAUDE_AGENTS_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    })
    const rows = JSON.parse(result.stdout) as readonly {
      pid?: unknown
      id?: unknown
    }[]

    const ids = new Map<number, string>()
    for (const row of rows) {
      if (typeof row.pid === 'number' && typeof row.id === 'string') {
        ids.set(row.pid, row.id)
      }
    }
    return ids
  } catch {
    return new Map()
  }
}

/**
 * Reports whether a worktree holds work no history is behind.
 *
 * Untracked files count for a directory that still exists, since a worktree is
 * gitignored scratch and a directory removed with them takes them nowhere
 * recoverable.
 *
 * Three states rather than two. A directory that is gone holds nothing at all,
 * so it reads as clean and leaves the merged and session checks to decide. A
 * read that failed is separated from both, because it produces the same empty
 * output as a clean tree and only one of them is safe to act on. The directory
 * test runs first because `git status` exits 128 for a missing path and for an
 * unreadable one alike, which folded the two into one refusal and reported
 * every hand-deleted worktree as unreadable.
 */
async function worktreeStatus(path: string): Promise<StatusReport> {
  if (!existsSync(path)) return { readable: true, dirty: false, missing: true }

  const result = await $`git -C ${path} status --porcelain`
    .env(gitEnv())
    .quiet()
    .nothrow()
  if (result.exitCode !== 0)
    return { readable: false, dirty: false, missing: false }

  return {
    readable: true,
    dirty: result.stdout.toString().trim().length > 0,
    missing: false,
  }
}

/**
 * Names the live sessions holding one worktree.
 *
 * The path match is the direct reading and the branch match is what survives a
 * path spelled differently on either side, such as a symlinked temporary
 * directory. The branch half is scoped to the repository, since a branch name
 * identifies a branch inside one and nothing across a machine.
 */
function holders(
  entry: WorktreeEntry,
  sessions: readonly ResolvedSession[],
  repository: string | null,
): readonly ResolvedSession[] {
  return sessions.filter(
    (candidate) =>
      candidate.worktree === entry.path ||
      (entry.branch !== null &&
        candidate.branch === entry.branch &&
        candidate.repository === repository),
  )
}

function verdict(
  entry: WorktreeEntry,
  isMain: boolean,
  isCurrent: boolean,
  status: StatusReport,
  merged: ReadonlyMap<string, number>,
  sessions: readonly ResolvedSession[],
  repository: string | null,
  agentIds: ReadonlyMap<number, string>,
): WorktreeVerdict {
  const held = holders(entry, sessions, repository)
  // An interactive holder carries no id to look up at all, so the branch is
  // explicit rather than relying on `claude agents --json` never reporting one
  // for a pid this repository's own registry marked interactive.
  const heldSessions: HeldSession[] = held.map((session) => ({
    name: session.name,
    kind: session.kind,
    id:
      session.kind === 'interactive'
        ? null
        : (agentIds.get(session.pid) ?? null),
  }))
  const pullRequest =
    entry.branch === null ? null : (merged.get(entry.branch) ?? null)
  const refusals: Refusal[] = []

  if (isMain) refusals.push('main-worktree')
  // Git removes the directory a caller is standing in without complaint, and
  // every later call scoped to that directory then fails, so a run that took it
  // would leave the branches behind it undeleted and report the failures as the
  // worktrees' own. The main worktree is already refused above, so this names
  // only a linked one.
  else if (isCurrent) refusals.push('current-worktree')

  if (entry.branch === null) refusals.push('detached-head')
  else if (pullRequest === null) refusals.push('no-merged-pull-request')

  if (!status.readable) refusals.push('unreadable-worktree')
  else if (status.dirty) refusals.push('uncommitted-changes')

  if (held.length > 0) refusals.push('held-by-session')

  return {
    path: entry.path,
    branch: entry.branch,
    reclaimable: refusals.length === 0,
    refusals,
    pullRequest,
    sessions: heldSessions,
    // No removal shape reaches the main worktree, and reporting one there
    // offers a command whose only effect is to break the checkout. Deciding it
    // here rather than in the reporter keeps the record and the framed output
    // answering the same way, since the two consumers act on different halves.
    route: isMain ? null : held.length > 0 ? 'session' : 'worktree',
    missing: status.missing,
  }
}

/**
 * Reports which worktrees are reclaimable and which are not, with the reason on
 * each.
 *
 * Reclaimable means all three of a merged pull request, a clean working tree,
 * and no live session holding the directory. Each alone has a case where
 * removal loses something, and removal is unrecoverable here since a worktree
 * is gitignored and no history stands behind it.
 *
 * The pull request is what decides the first condition rather than git
 * ancestry. A repository that squash merges never makes a merged branch an
 * ancestor of its trunk, so the ancestry reading calls shipped work unmerged
 * and calls an abandoned branch sitting at a release commit merged, which is
 * wrong in the one direction that removes a directory.
 *
 * An unreadable input refuses the whole reading rather than producing verdicts
 * around it. An absent merge state and a branch with no merged pull request
 * produce the same empty answer, as do an absent session roster and a worktree
 * nobody holds, and reporting the second when it was the first is a false clean
 * that ends in a removal.
 */
export async function reclaimReport(
  opts: ReclaimOptions = {},
): Promise<ReclaimReport> {
  const cwd = opts.cwd ?? process.cwd()
  const listAll = opts.listWorktrees ?? listWorktrees
  const readMerged = opts.mergedPullRequests ?? mergedPullRequests
  const readStatus = opts.worktreeStatus ?? worktreeStatus
  const resolve = opts.resolve ?? resolveSessions
  const readAgentIds = opts.claudeAgentIds ?? claudeAgentIds

  const [entries, merged, sessions, repository, current, agentIds] =
    await Promise.all([
      listAll(cwd),
      readMerged(cwd),
      resolve(),
      repositoryOf(cwd),
      currentWorktreeRoot(cwd),
      readAgentIds(cwd),
    ])

  if (merged.kind === 'unreadable') {
    return {
      kind: 'unreadable',
      reason: merged.reason,
      detail: merged.detail,
    }
  }

  if (sessions.kind !== 'resolved') {
    return {
      kind: 'unreadable',
      reason: 'sessions-unreadable',
      detail: `No session registry at ${sessions.dir}, so nothing was read about which worktrees are still held.`,
    }
  }

  const byBranch = new Map(
    merged.merged.map((request) => [request.branch, request.number]),
  )
  const statuses = await Promise.all(
    entries.map((entry) => readStatus(entry.path)),
  )

  // `git worktree list` puts the main worktree first, which is the only signal
  // separating it from a linked one in the porcelain output.
  const worktrees = entries.map((entry, index) =>
    verdict(
      entry,
      index === 0,
      entry.path === current,
      statuses[index] ?? { readable: false, dirty: false, missing: false },
      byBranch,
      sessions.sessions,
      repository,
      agentIds,
    ),
  )

  return { kind: 'read', worktrees }
}
