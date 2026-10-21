import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import {
  type ReclaimOptions,
  reclaimReport,
  type Refusal,
  type Unreadable,
  type WorktreeVerdict,
} from '@/worktrees/reclaim'
import { removeReclaimable } from '@/worktrees/remove'

const GH_TIMEOUT_MS = 30_000
const GIT_TIMEOUT_MS = 60_000

/** Matches the reclaim's merged read, so an open pull request older than this is missed the same way. */
const OPEN_LIMIT = 200

/**
 * The fixed lead the integrator's body carries, stated in the auto-ship
 * fan-in reference. Anything outside this one line is never read, so a branch
 * named in prose is never a candidate.
 */
const MEMBER_LINE = /^[ \t]*(?:[-*][ \t]+)?Fan-in members:(.*)$/m
const BACKTICKED = /`([^`\s]+)`/g

/**
 * Why the whole run was refused before any member was judged. Every one of
 * these deletes nothing at all, since each is an input the per-branch checks
 * stand on or a body that names something no merge retires.
 */
export type MembersRefusal =
  | Extract<
      Unreadable,
      'gh-missing' | 'gh-failed' | 'sessions-unreadable' | 'sessions-unchecked'
    >
  | 'not-merged'
  | 'no-members'
  | 'trunk-named'
  | 'head-named'
  | 'open-pull-request'
  | 'head-unreadable'

/**
 * Why one half of one member was kept. The worktree reasons are the reclaim's
 * own, since the same reading decided them.
 */
export type MemberRefusal =
  | 'not-in-merged-head'
  | 'remote-unreadable'
  | 'worktree-kept'
  | Exclude<Refusal, 'no-merged-pull-request'>

export type HalfState =
  | 'deleted'
  | 'would-delete'
  | 'kept'
  | 'absent'
  | 'failed'

export interface Half {
  readonly state: HalfState
  /** Every reason the half was kept, empty for any other state. */
  readonly reasons: readonly MemberRefusal[]
  /** The git error on a failed half, null otherwise. */
  readonly detail: string | null
}

export interface MemberOutcome {
  readonly branch: string
  readonly origin: Half
  /** Null when no worktree holds the branch. */
  readonly worktree: (Half & { readonly path: string }) | null
  readonly local: Half
}

export type MembersReport =
  | {
      readonly kind: 'refused'
      readonly reason: MembersRefusal
      readonly detail: string
      /** The branches the member line named, empty when no line was read. */
      readonly members: readonly string[]
    }
  | { readonly kind: 'read'; readonly members: readonly MemberOutcome[] }

export interface CommandResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

type Runner = (cwd: string, args: readonly string[]) => Promise<CommandResult>

export interface MembersOptions {
  /** Where the reclaim reading runs, which is what refuses the worktree the caller stands in. */
  readonly cwd: string
  /** The main worktree root, where every git write runs, for the reason `removeReclaimable` states. */
  readonly root: string
  readonly dryRun?: boolean
  /** Null when `gh` is not on the path. */
  readonly gh?: Runner | null
  readonly git?: Runner
  /** Overrides for the reclaim reading, past the merged read this module always supplies. */
  readonly reclaim?: Omit<ReclaimOptions, 'cwd' | 'mergedPullRequests'>
}

async function run(
  command: string,
  cwd: string,
  args: readonly string[],
  timeout: number,
): Promise<CommandResult> {
  // A hook exports git's resolution variables, which beat both `-C` and the
  // working directory `gh` resolves its repository through.
  const result = await execa(command, [...args], {
    cwd,
    timeout,
    env: gitEnv(),
    extendEnv: false,
    reject: false,
  })
  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout,
    stderr: result.stderr.trim(),
  }
}

const runGit: Runner = (cwd, args) => run('git', cwd, args, GIT_TIMEOUT_MS)
const runGh: Runner = (cwd, args) => run('gh', cwd, args, GH_TIMEOUT_MS)

/**
 * Reads the branches an integrator's body names on its member line, in the
 * order named. Only backticked names after the fixed lead count, and a body
 * carrying no such line names nobody.
 */
export function parseMembers(body: string): string[] {
  const line = MEMBER_LINE.exec(body)
  if (line === null) return []

  const names = [...(line[1] ?? '').matchAll(BACKTICKED)].map(
    (match) => match[1] ?? '',
  )
  return [...new Set(names.filter((name) => name.length > 0))]
}

interface PullRequestView {
  readonly state: string
  readonly body: string
  readonly headRefName: string
  readonly headRefOid: string
  readonly baseRefName: string
}

function isView(value: unknown): value is PullRequestView {
  if (value === null || typeof value !== 'object') return false
  const fields = value as Record<string, unknown>
  return ['state', 'body', 'headRefName', 'headRefOid', 'baseRefName'].every(
    (key) => typeof fields[key] === 'string',
  )
}

function parseJson(stdout: string): unknown {
  try {
    return JSON.parse(stdout)
  } catch {
    return undefined
  }
}

function refused(
  reason: MembersRefusal,
  detail: string,
  members: readonly string[] = [],
): MembersReport {
  return { kind: 'refused', reason, detail, members }
}

const kept = (...reasons: MemberRefusal[]): Half => ({
  state: 'kept',
  reasons,
  detail: null,
})
const plain = (state: HalfState, detail: string | null = null): Half => ({
  state,
  reasons: [],
  detail,
})

interface Plan {
  readonly branch: string
  /** The tip origin holds, null when origin has no such branch. */
  readonly originTip: string | null
  readonly origin: Half
  readonly verdict: WorktreeVerdict | null
  readonly localTip: string | null
  readonly worktree: Half | null
  readonly local: Half
}

/**
 * Retires the fan-in members an integrator's merged pull request names: each
 * one's origin branch, its worktree, and its local branch.
 *
 * Merged here means reachable from the integrator's merged head, not merged
 * into the trunk. The integrator squash merges, so no member is ever an
 * ancestor of the trunk, but every member was merged into the integrator's
 * branch before it shipped. A commit landing on a member after that merge is
 * work the squash did not carry, and its tip stops being an ancestor.
 *
 * Origin and local are judged apart, since an unpushed local commit and a
 * commit pushed from elsewhere each keep only their own half. The worktree
 * takes the reclaim's reading with the members injected as its merged answer,
 * so a held, dirty, or current worktree is refused by the same rules as
 * everywhere else, and its local branch stays with it because git refuses to
 * delete a branch a registered worktree holds.
 *
 * Every input is read before anything is deleted, and an unreadable one
 * refuses the whole run, for the reason `reclaimReport` states.
 */
export async function retireMembers(
  pullRequest: number,
  opts: MembersOptions,
): Promise<MembersReport> {
  const { cwd, root } = opts
  const dryRun = opts.dryRun ?? false
  const gh = opts.gh === undefined ? (Bun.which('gh') ? runGh : null) : opts.gh
  const git = opts.git ?? runGit

  if (gh === null) {
    return refused(
      'gh-missing',
      'gh is not on the path, so the pull request could not be read.',
    )
  }

  const viewed = await gh(root, [
    'pr',
    'view',
    String(pullRequest),
    '--json',
    'state,body,headRefName,headRefOid,baseRefName',
  ])
  const view = viewed.exitCode === 0 ? parseJson(viewed.stdout) : undefined
  if (!isView(view)) {
    return refused(
      'gh-failed',
      viewed.stderr || `gh pr view ${pullRequest} returned no readable record.`,
    )
  }

  const members = parseMembers(view.body)
  if (view.state !== 'MERGED') {
    return refused(
      'not-merged',
      `#${pullRequest} is ${view.state.toLowerCase()}, so nothing it names has shipped.`,
      members,
    )
  }
  if (members.length === 0) {
    return refused(
      'no-members',
      `#${pullRequest} carries no "Fan-in members:" line.`,
    )
  }

  if (members.includes(view.baseRefName)) {
    return refused(
      'trunk-named',
      `The member line names ${view.baseRefName}, the branch #${pullRequest} merged into.`,
      members,
    )
  }
  if (members.includes(view.headRefName)) {
    return refused(
      'head-named',
      `The member line names ${view.headRefName}, the integrator's own branch.`,
      members,
    )
  }

  const listed = await gh(root, [
    'pr',
    'list',
    '--state',
    'open',
    '--limit',
    String(OPEN_LIMIT),
    '--json',
    'headRefName,number',
  ])
  const open = listed.exitCode === 0 ? parseJson(listed.stdout) : undefined
  if (!Array.isArray(open)) {
    return refused(
      'gh-failed',
      listed.stderr || 'gh pr list returned no readable record.',
      members,
    )
  }
  const openHeads = new Set(
    open.flatMap((row: unknown) =>
      row !== null &&
      typeof row === 'object' &&
      typeof (row as Record<string, unknown>).headRefName === 'string'
        ? [(row as Record<string, string>).headRefName]
        : [],
    ),
  )
  const stillOpen = members.filter((branch) => openHeads.has(branch))
  if (stillOpen.length > 0) {
    return refused(
      'open-pull-request',
      `${stillOpen.join(', ')} has an open pull request of its own, so it is not a member this merge retires.`,
      members,
    )
  }

  const reading = await reclaimReport({
    ...opts.reclaim,
    cwd,
    mergedPullRequests: async () => ({
      kind: 'read',
      merged: members.map((branch) => ({ branch, number: pullRequest })),
    }),
  })
  if (reading.kind === 'unreadable') {
    // The merged read is injected, so only the session refusals reach here.
    const reason =
      reading.reason === 'sessions-unchecked'
        ? 'sessions-unchecked'
        : 'sessions-unreadable'
    return refused(reason, reading.detail, members)
  }

  // With head-branch deletion on, the integrator's branch is gone from origin
  // by now, and GitHub keeps this ref for every pull request it has opened.
  const fetched = await git(root, [
    'fetch',
    '--quiet',
    '--no-tags',
    'origin',
    `refs/pull/${pullRequest}/head`,
  ])
  const fetchHead =
    fetched.exitCode === 0
      ? await git(root, ['rev-parse', '--verify', '--quiet', 'FETCH_HEAD'])
      : null
  if (fetchHead === null || fetchHead.stdout.trim() !== view.headRefOid) {
    return refused(
      'head-unreadable',
      fetched.stderr ||
        `refs/pull/${pullRequest}/head does not resolve to ${view.headRefOid}, the head GitHub reports merged.`,
      members,
    )
  }

  const merged = async (tip: string) =>
    (await git(root, ['merge-base', '--is-ancestor', tip, view.headRefOid]))
      .exitCode === 0

  const plans: Plan[] = []
  for (const branch of members) {
    plans.push(
      await judge(branch, {
        git,
        root,
        merged,
        dryRun,
        verdict:
          reading.worktrees.find((entry) => entry.branch === branch) ?? null,
      }),
    )
  }

  if (dryRun) {
    return {
      kind: 'read',
      members: plans.map(({ branch, origin, verdict, worktree, local }) => ({
        branch,
        origin,
        worktree:
          verdict === null || worktree === null
            ? null
            : { ...worktree, path: verdict.path },
        local,
      })),
    }
  }

  const outcomes: MemberOutcome[] = []
  for (const plan of plans) outcomes.push(await act(plan, git, root))
  return { kind: 'read', members: outcomes }
}

interface JudgeContext {
  readonly git: Runner
  readonly root: string
  readonly merged: (tip: string) => Promise<boolean>
  readonly dryRun: boolean
  readonly verdict: WorktreeVerdict | null
}

/** Decides each half of one member from its own tip, deleting nothing. */
async function judge(branch: string, context: JudgeContext): Promise<Plan> {
  const { git, root, merged, dryRun, verdict } = context
  const go: Half = plain(dryRun ? 'would-delete' : 'deleted')

  // Read from origin itself rather than the tracking ref, which holds only
  // what the last fetch saw and misses a commit pushed since.
  const remote = await git(root, [
    'ls-remote',
    '--heads',
    'origin',
    `refs/heads/${branch}`,
  ])
  const originTip =
    remote.exitCode === 0 ? (remote.stdout.trim().split(/\s/)[0] ?? '') : null
  const origin =
    originTip === null
      ? kept('remote-unreadable')
      : originTip === ''
        ? plain('absent')
        : (await merged(originTip))
          ? go
          : kept('not-in-merged-head')

  const head = await git(root, [
    'rev-parse',
    '--verify',
    '--quiet',
    `refs/heads/${branch}`,
  ])
  const localTip = head.exitCode === 0 ? head.stdout.trim() : null
  const localMerged = localTip !== null && (await merged(localTip))

  const worktreeReasons: MemberRefusal[] = [
    ...(verdict?.refusals.filter(
      (refusal): refusal is Exclude<Refusal, 'no-merged-pull-request'> =>
        refusal !== 'no-merged-pull-request',
    ) ?? []),
    ...(localTip !== null && !localMerged
      ? (['not-in-merged-head'] as const)
      : []),
  ]
  const worktree =
    verdict === null
      ? null
      : worktreeReasons.length > 0
        ? kept(...worktreeReasons)
        : go

  const local =
    localTip === null
      ? plain('absent')
      : !localMerged
        ? kept('not-in-merged-head')
        : worktree !== null && worktree.state === 'kept'
          ? kept('worktree-kept')
          : go

  return {
    branch,
    originTip: originTip === '' ? null : originTip,
    origin,
    verdict,
    localTip,
    worktree,
    local,
  }
}

/** Carries out one member's plan: origin first, then the worktree and its branch. */
async function act(
  plan: Plan,
  git: Runner,
  root: string,
): Promise<MemberOutcome> {
  const { branch, verdict } = plan

  let origin = plan.origin
  if (origin.state === 'deleted' && plan.originTip !== null) {
    // The lease names the tip judged above, so a commit pushed between the
    // judgment and the push keeps the branch rather than going with it.
    const pushed = await git(root, [
      'push',
      '--quiet',
      `--force-with-lease=refs/heads/${branch}:${plan.originTip}`,
      'origin',
      `:refs/heads/${branch}`,
    ])
    if (pushed.exitCode !== 0) origin = plain('failed', pushed.stderr || null)
  }

  if (verdict !== null && plan.worktree !== null) {
    if (plan.worktree.state !== 'deleted') {
      return {
        branch,
        origin,
        worktree: { ...plan.worktree, path: verdict.path },
        local: plan.local,
      }
    }

    const [removed] = (
      await removeReclaimable([{ ...verdict, reclaimable: true }], {
        cwd: root,
        git,
      })
    ).outcomes
    const worktreeGone = removed !== undefined && removed.failedAt !== 'remove'
    const worktree = worktreeGone
      ? plain('deleted')
      : plain('failed', removed?.detail ?? null)
    const local = !worktreeGone
      ? kept('worktree-kept')
      : removed.failedAt === 'branch'
        ? plain('failed', removed.detail)
        : plain('deleted')
    return {
      branch,
      origin,
      worktree: { ...worktree, path: verdict.path },
      local,
    }
  }

  let local = plan.local
  if (local.state === 'deleted' && plan.localTip !== null) {
    // The old value guards the delete the way the lease guards the push.
    const deleted = await git(root, [
      'update-ref',
      '-d',
      `refs/heads/${branch}`,
      plan.localTip,
    ])
    if (deleted.exitCode !== 0) local = plain('failed', deleted.stderr || null)
  }

  return { branch, origin, worktree: null, local }
}
