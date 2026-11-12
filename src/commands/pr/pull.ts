import { realpath } from 'node:fs/promises'
import { $ } from 'bun'
import { execa } from 'execa'
import { gitEnv } from '@/git/env'
import { type HeadRefusal } from '@/pr/head'
import { type GitRunner } from '@/pr/lift'
import {
  commentRowOf,
  identityOf,
  type PullIdentity,
  parseJsonLines,
  type RestComment,
  type RestPull,
  type RestReview,
  selectBranchPull,
} from '@/pr/rest'
import { logStep, logWarn, outro } from '@/cli/ui'

export const GH_TIMEOUT_MS = 30_000

export interface ReadOptions {
  readonly root?: string
  readonly json?: boolean
}

/** Shared by every verb that resolves a pull request from the checkout's branch. */
export const AMBIGUOUS_PULL =
  'More than one pull request is open on this branch, each against another base. Name the pull request number.'

/** Why a head-sensitive read produced no answer about a commit. */
export type PullRefusal =
  | 'gh-missing'
  | 'gh-failed'
  | 'ambiguous-pull'
  | 'no-branch'
  | 'runs-unreadable'
  | 'reviews-unreadable'

/** What a reader does about each way the two sha-keyed verbs produced nothing. */
export const PULL_REFUSALS: Record<PullRefusal | HeadRefusal, string> = {
  'gh-missing':
    'gh is not on the path, so no pull request could be resolved. Name the branch through a checkout that carries one.',
  'gh-failed':
    'gh could not answer for this branch. Name the pull request number instead.',
  'ambiguous-pull': AMBIGUOUS_PULL,
  'no-branch':
    'The pull request carries no head branch name, so no ref could be read for it.',
  'unresolvable-ref':
    'git could not read the remote, so the branch tip is unknown. That is a failed read rather than an absent branch, so nothing is reported about the head.',
  'no-remote-branch':
    'The remote carries no branch by that name. It was deleted or never pushed, so there is no tip to compare against.',
  'no-object-head':
    'The pull request object reported no head commit, so there is nothing to compare the tip against.',
  'runs-unreadable':
    'The check runs for this commit could not be read. An empty answer here would report a commit as having no check rather than as unread, so nothing is reported.',
  'reviews-unreadable':
    'The reviews on this pull request could not be read. An empty answer here would report a reviewed pull request as never reviewed, which routes the next pass to the whole change, so nothing is reported.',
}

type IdentityRead =
  | { readonly kind: 'read'; readonly identity: PullIdentity }
  | { readonly kind: 'refused'; readonly reason: PullRefusal }

/**
 * Runs one `gh` invocation and hands back its stdout, or null when it failed.
 *
 * See src/worktrees/reclaim.ts for why gh needs the stripped environment: it
 * resolves its repository through the same variables git does and they beat
 * `cwd`, so a run from inside a hook would answer for another repository.
 */
export async function gh(
  cwd: string,
  args: readonly string[],
): Promise<string | null> {
  try {
    const result = await execa('gh', [...args], {
      cwd,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    })
    return result.stdout
  } catch {
    return null
  }
}

type PullNumber =
  | { readonly kind: 'found'; readonly number: string }
  | {
      readonly kind: 'refused'
      readonly reason: 'gh-failed' | 'ambiguous-pull'
    }

/**
 * The number the caller named, or the one open pull request on the branch the
 * checkout at `cwd` holds.
 *
 * `{owner}` in the head filter is the base repository's owner, which is the
 * head owner for every pull request opened from a branch of this repository.
 */
export async function resolvePullNumber(
  cwd: string,
  number: string | undefined,
): Promise<PullNumber> {
  if (number !== undefined) return { kind: 'found', number }

  const branch = await $`git -C ${cwd} symbolic-ref --short -q HEAD`
    .env(gitEnv())
    .quiet()
    .nothrow()
  const name = branch.exitCode === 0 ? branch.text().trim() : ''
  if (name === '') return { kind: 'refused', reason: 'gh-failed' }

  const stdout = await gh(cwd, [
    'api',
    `repos/{owner}/{repo}/pulls?head={owner}:${encodeURIComponent(name)}&state=open&per_page=100`,
  ])
  if (stdout === null) return { kind: 'refused', reason: 'gh-failed' }

  let rows: readonly RestPull[]
  try {
    rows = JSON.parse(stdout)
  } catch {
    return { kind: 'refused', reason: 'gh-failed' }
  }
  const selected = selectBranchPull(rows)
  return selected.kind === 'found'
    ? { kind: 'found', number: String(selected.number) }
    : selected
}

type PullRead =
  | { readonly kind: 'read'; readonly row: RestPull }
  | {
      readonly kind: 'refused'
      readonly reason: 'gh-failed' | 'ambiguous-pull'
    }

/**
 * The pull request object off the REST pull endpoint, which a cloud session's
 * proxy serves where it refuses the GraphQL every `gh pr view` runs on.
 */
export async function readPull(
  cwd: string,
  number: string | undefined,
): Promise<PullRead> {
  const resolved = await resolvePullNumber(cwd, number)
  if (resolved.kind === 'refused') return resolved

  const stdout = await gh(cwd, [
    'api',
    `repos/{owner}/{repo}/pulls/${resolved.number}`,
  ])
  if (stdout === null) return { kind: 'refused', reason: 'gh-failed' }
  try {
    return { kind: 'read', row: JSON.parse(stdout) as RestPull }
  } catch {
    return { kind: 'refused', reason: 'gh-failed' }
  }
}

type PagesRead<T> =
  | { readonly kind: 'read'; readonly rows: readonly T[] }
  | { readonly kind: 'refused'; readonly reason: 'gh-failed' | 'unparsed' }

/**
 * Every row of a paginated listing, or a refusal when any page failed.
 *
 * A refusal rather than an empty list, since a refused read that reads as no
 * reviews routes the next pass to the whole change.
 */
async function listPages<T>(
  cwd: string,
  path: string,
  fields: string,
): Promise<PagesRead<T>> {
  const stdout = await gh(cwd, [
    'api',
    '--paginate',
    `${path}?per_page=100`,
    '--jq',
    `.[] | {${fields}} | @json`,
  ])
  if (stdout === null) return { kind: 'refused', reason: 'gh-failed' }
  const rows = parseJsonLines<T>(stdout)
  return rows === undefined
    ? { kind: 'refused', reason: 'unparsed' }
    : { kind: 'read', rows }
}

export async function listReviews(cwd: string, number: string) {
  return listPages<RestReview>(
    cwd,
    `repos/{owner}/{repo}/pulls/${number}/reviews`,
    'id, body, commit_id, submitted_at, state',
  )
}

/** The issue comments on a pull request, or undefined when the thread is unread. */
export async function listComments(
  cwd: string,
  number: string,
): Promise<readonly { url?: string; body: string }[] | undefined> {
  const read = await listPages<RestComment>(
    cwd,
    `repos/{owner}/{repo}/issues/${number}/comments`,
    'html_url, body',
  )
  return read.kind === 'read' ? read.rows.map(commentRowOf) : undefined
}

/**
 * Reads the head branch and the head the pull request object reports.
 *
 * Both come from one call, so the branch a ref is read for and the head that
 * ref is compared against describe the same object.
 */
export async function readIdentity(
  cwd: string,
  number: string | undefined,
): Promise<IdentityRead> {
  if (Bun.which('gh') === null) {
    return { kind: 'refused', reason: 'gh-missing' }
  }

  const pull = await readPull(cwd, number)
  if (pull.kind === 'refused') return pull

  const identity: PullIdentity = identityOf(pull.row)
  if (identity.branch === '') return { kind: 'refused', reason: 'no-branch' }

  return { kind: 'read', identity }
}

/**
 * Reads the branch tip from the remote rather than from a tracking ref.
 *
 * A tracking ref is only as current as the last fetch, and the push this is
 * meant to catch is one this process never saw.
 */
export function refReader(root: string) {
  return async (branch: string): Promise<string | null> => {
    const result = await $`git -C ${root} ls-remote --heads origin ${branch}`
      .env(gitEnv())
      .quiet()
      .nothrow()
    return result.exitCode === 0 ? result.text() : null
  }
}

interface PullFiles {
  /** Each path that still exists at the head, tagged with whether the pull request added it. */
  readonly present: ReadonlyMap<string, boolean>
  /** Each path the pull request removed, which a deploy's push filter still counts. */
  readonly removed: readonly string[]
  /** Each renamed path mapped to the path it sat at before the pull request. */
  readonly renamedFrom: ReadonlyMap<string, string>
}

/**
 * The paths a pull request changed, read through the paginated files endpoint
 * so the set is the same from any checkout and never capped at the first
 * view. `copied` counts as added, since a copy leaves its source in place and
 * has no single base. `renamed` counts as added in `present` too, so the
 * changed set stays the same, and `renamedFrom` carries the old path of each
 * rename for a reader that compares against the base. Returns undefined when
 * the read fails, which refuses rather than rendering a short set.
 */
export async function listPullFiles(
  cwd: string,
  number: number,
): Promise<PullFiles | undefined> {
  const stdout = await gh(cwd, [
    'api',
    '--paginate',
    `repos/{owner}/{repo}/pulls/${number}/files`,
    '--jq',
    '.[] | [.status, .filename, (.previous_filename // "")] | @tsv',
  ])
  if (stdout === null) return undefined
  const present = new Map<string, boolean>()
  const removed: string[] = []
  const renamedFrom = new Map<string, string>()
  for (const line of stdout.split('\n').filter(Boolean)) {
    const [status, path, previous] = line.split('\t')
    if (status === undefined || path === undefined) continue
    if (status === 'removed') removed.push(path)
    else present.set(path, status !== 'modified' && status !== 'changed')
    if (status === 'renamed' && previous !== undefined && previous !== '') {
      renamedFrom.set(path, previous)
    }
  }
  return { present, removed, renamedFrom }
}

export function everyChangedPath(files: PullFiles): string[] {
  return [...files.present.keys(), ...files.removed]
}

/** The worktree's toplevel with symlinks resolved, since a process cwd is read back resolved. */
export async function resolveWorktreeRoot(root: string): Promise<string> {
  const result = await $`git -C ${root} rev-parse --show-toplevel`
    .env(gitEnv())
    .quiet()
    .nothrow()
  const toplevel = result.exitCode === 0 ? result.text().trim() : root
  return realpath(toplevel).catch(() => toplevel)
}

export const POSITIVE_WHOLE = /^[1-9]\d*$/

/** Replaces a pull request's body, which `gh` takes through the REST pulls endpoint a cloud proxy serves. */
export async function patchPullBody(
  root: string,
  number: number,
  body: string,
): Promise<boolean> {
  const patched = await gh(root, [
    'api',
    '-X',
    'PATCH',
    `repos/{owner}/{repo}/pulls/${number}`,
    '-f',
    `body=${body}`,
  ])
  return patched !== null
}

/** `owner/repo` off the REST repository read, since `gh repo view` runs on GraphQL. */
export async function readRepoName(root: string): Promise<string | undefined> {
  const row = await gh(root, ['api', 'repos/{owner}/{repo}'])
  if (row === null) return undefined
  try {
    const name = (JSON.parse(row) as { full_name?: unknown }).full_name
    return typeof name === 'string' ? name : undefined
  } catch {
    return undefined
  }
}

export function gitRunner(root: string): GitRunner {
  return async (args) => {
    const result = await execa('git', ['-C', root, ...args], {
      reject: false,
      timeout: GH_TIMEOUT_MS,
      env: gitEnv(),
      extendEnv: false,
    })
    return result.exitCode === 0 ? String(result.stdout) : undefined
  }
}

export function refuseWith(
  reason: string,
  message: string,
  emitJson: boolean,
  root: string,
  extra: Record<string, unknown> = {},
): number {
  logStep('Refused')
  logWarn(message)
  outro()

  if (emitJson) {
    process.stdout.write(
      `${JSON.stringify({ root, reason, message, ...extra })}\n`,
    )
  }
  return 1
}
