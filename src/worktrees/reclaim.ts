import { $ } from 'bun'
import { execa } from 'execa'
import { existsSync, realpathSync } from 'node:fs'
import { resolve as resolvePath, sep } from 'node:path'
import { gitEnv } from '@/git/env'
import {
  type BranchInput,
  branchReport,
  type BranchReport,
} from '@/worktrees/branches'
import {
  type ForeignRecord,
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
export type Unreadable =
  | 'gh-missing'
  | 'gh-failed'
  | 'sessions-unreadable'
  | 'sessions-unchecked'

/**
 * Which removal shape applies. `session` removes the background session and its
 * worktree together, and `worktree` removes a directory whose session has ended.
 * Picking the wrong one strands state, so it is reported rather than assumed.
 */
export type Route = 'session' | 'worktree'

/** No removal shape reaches the main worktree, which is what `null` says. */
export type RemovalRoute = Route | null

/**
 * One live session holding a worktree, enriched with the id `claude rm` takes.
 * `id` is null for an interactive holder, which carries none, and for a
 * background holder whose id `claude agents --json` could not resolve.
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
  /** The commit the pull request merged from, absent when the read did not ask for it. */
  readonly headOid?: string
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
  | {
      readonly kind: 'read'
      readonly worktrees: readonly WorktreeVerdict[]
      /**
       * The local branches no worktree holds. Read apart from the worktrees, so
       * a listing that failed leaves the worktree verdicts standing.
       */
      readonly branches: BranchReport
    }

export interface ReclaimOptions {
  readonly cwd?: string
  readonly listWorktrees?: (cwd: string) => Promise<readonly WorktreeEntry[]>
  readonly mergedPullRequests?: (cwd: string) => Promise<MergedReport>
  readonly worktreeStatus?: (path: string) => Promise<StatusReport>
  readonly resolve?: () => Promise<SessionReport>
  readonly claudeAgentIds?: (
    cwd: string,
  ) => Promise<ReadonlyMap<number, string>>
  readonly branchReport?: (input: BranchInput) => Promise<BranchReport>
}

/**
 * Reads the pull request state for the whole repository in one call, since the
 * per-worktree shape is a network round trip inside a loop and the branches
 * being matched are already known.
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
    'headRefName,number,headRefOid',
  ]

  try {
    // `gh` honors a hook's git variables over `cwd`, so they are cleared, or a same-named branch misleads.
    const result = await execa('gh', args, {
      cwd,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    })
    const rows = JSON.parse(result.stdout) as readonly {
      headRefName: string
      number: number
      headRefOid?: string
    }[]

    return {
      kind: 'read',
      merged: rows.map((row) => ({
        branch: row.headRefName,
        number: row.number,
        ...(typeof row.headRefOid === 'string'
          ? { headOid: row.headRefOid }
          : {}),
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
 * agents --json`. It degrades rather than refusing, since the id only enriches
 * the report while merge state decides whether a removal is safe.
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
 * Reports whether a worktree holds work no history is behind. Untracked files
 * count, a missing directory reads clean, and a failed read stays separate. The
 * directory test runs first, since `git status` exits 128 for missing and unreadable.
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
 * Names the live sessions holding one worktree. The path match is direct, and the
 * branch match survives a path spelled differently, such as a symlinked temporary
 * directory, scoped to the repository, since a branch name is local to one.
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
  // An interactive holder carries no id, so the branch is explicit.
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
  // Removing the caller's own directory breaks every later call scoped to it.
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
    // No removal shape reaches the main worktree, so the record and framed output agree here.
    route: isMain ? null : held.length > 0 ? 'session' : 'worktree',
    missing: status.missing,
  }
}

/** Both spellings of a path, since a record and git can disagree over a symlink. */
function spellings(path: string): readonly string[] {
  const plain = resolvePath(path)
  try {
    const real = realpathSync(plain)
    return real === plain ? [plain] : [plain, real]
  } catch {
    return [plain]
  }
}

function within(path: string, roots: readonly string[]): boolean {
  return spellings(path).some((candidate) =>
    roots.some(
      (root) => candidate === root || candidate.startsWith(root + sep),
    ),
  )
}

/**
 * The foreign records that could be holding a worktree here, keyed on the folder
 * each recorded: at or under the main root or a worktree. A record at an ancestor,
 * such as the home folder, cannot be told from one that later moved in, and is
 * passed, since a session holding a worktree runs inside it. Null clears the read.
 * Every record blocks, unnamed, when the list or the worktrees could not be read.
 */
function blockingForeign(
  sessions: Extract<SessionReport, { kind: 'resolved' }>,
  entries: readonly WorktreeEntry[],
): readonly ForeignRecord[] | null {
  if (sessions.foreignDead === 0) return null
  if (sessions.foreign === undefined || entries.length === 0) return []

  const roots = entries.flatMap((entry) => spellings(entry.path))
  const inside = sessions.foreign.filter((record) => within(record.cwd, roots))
  return inside.length > 0 ? inside : null
}

function uncheckedDetail(
  count: number,
  blocking: readonly ForeignRecord[],
): string {
  if (blocking.length === 0) {
    return `${count} session records come from another pid namespace and no socket answers for them, so nothing was read about whether they still hold a worktree.`
  }
  const named = blocking
    .map((record) => `${record.path} (working folder ${record.cwd})`)
    .join('; ')
  return `${blocking.length} session records from another pid namespace have no answering socket and a working folder inside this repository, so nothing was read about whether they still hold a worktree: ${named}.`
}

/**
 * Reports which worktrees are reclaimable, with the reason on each: a merged pull
 * request, a clean tree, and no live session, since removal is unrecoverable. The
 * pull request decides merged, not ancestry, and an unreadable input refuses.
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
  const readBranches = opts.branchReport ?? branchReport

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

  // A foreign record whose socket is gone may be a live holder this reader cannot see, so refuse.
  const blocking = blockingForeign(sessions, entries)
  if (blocking !== null) {
    return {
      kind: 'unreadable',
      reason: 'sessions-unchecked',
      detail: uncheckedDetail(sessions.foreignDead, blocking),
    }
  }

  const byBranch = new Map(
    merged.merged.map((request) => [request.branch, request.number]),
  )
  const statuses = await Promise.all(
    entries.map((entry) => readStatus(entry.path)),
  )

  // `git worktree list` puts the main worktree first, the only signal separating it.
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

  // An empty listing is a failed read, since every repository lists its main worktree.
  const branches: BranchReport =
    entries.length === 0
      ? {
          kind: 'unreadable',
          detail:
            'git worktree list returned nothing, so no branch could be told apart from one a worktree holds.',
        }
      : await readBranches({
          cwd,
          worktreeBranches: new Set(
            entries.flatMap((entry) =>
              entry.branch === null ? [] : [entry.branch],
            ),
          ),
          merged: merged.merged,
          sessions: sessions.sessions,
          repository,
        })

  return { kind: 'read', worktrees, branches }
}
