import { execa } from 'execa'
import { gitEnv } from '@/git-env'
import { isDirectory } from '@/targets/validate'

const GH_TIMEOUT_MS = 30_000

/**
 * The two headings a review pass posts under.
 *
 * Owned by `review-pr`, which states the full set once, and pinned here
 * the way `role-orchestrator/scripts/poll.ts` pins them. All three surfaces
 * ship separately, so a heading added in that skill goes stale here with
 * nothing comparing the copies.
 */
const REVIEW_OPEN = '## Review'
const REVIEW_CLOSED = '## Review closed'

/** Why a target produced no reading, so an unreachable one never reads as having no work. */
export type TargetRefusal = 'not-a-directory' | 'gh-unavailable' | 'list-failed'

export type ChecksState = 'passing' | 'failing' | 'pending'

/** Whether the newest review pass left work owed. */
export type ReviewState = 'open' | 'closed'

export interface PullState {
  readonly number: number
  readonly title: string
  readonly url: string
  readonly head: string
  /** Null when GitHub reported no check at all, which is not the same answer as passing. */
  readonly checks: ChecksState | null
  /** Null when no pass carrying a review heading has landed on the thread. */
  readonly review: ReviewState | null
  /** False when the review read failed, leaving `review` covering nothing. */
  readonly reviewReadable: boolean
}

export type TargetPulls =
  | {
      readonly kind: 'refused'
      readonly path: string
      readonly reason: TargetRefusal
    }
  | {
      readonly kind: 'read'
      readonly path: string
      readonly pulls: readonly PullState[]
    }

/** Runs one `gh` invocation in a target and hands back its stdout, or null when it failed. */
export type GhRunner = (
  cwd: string,
  args: readonly string[],
) => Promise<string | null>

export interface PullsOptions {
  readonly run?: GhRunner
}

/**
 * `gh` resolves its repository through the same environment variables git does
 * and they beat `cwd`, so a run from inside a hook would read whichever
 * repository that hook's environment names rather than the target handed here.
 */
const runGh: GhRunner = async (cwd, args) => {
  if (Bun.which('gh') === null) return null

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

interface RawPull {
  readonly number?: number
  readonly title?: string
  readonly url?: string
  readonly headRefOid?: string
  readonly statusCheckRollup?: readonly RawCheck[]
}

/**
 * One check as the pull request listing spells it, in the GraphQL enum.
 *
 * Exported because `src/pr/checks.ts` adapts the REST check-run row onto it
 * rather than writing a second collapse beside `rollup`.
 */
export interface RawCheck {
  readonly status?: string
  readonly conclusion?: string
  readonly state?: string
}

interface RawReview {
  readonly body?: string
  readonly submittedAt?: string
}

const FAILED = new Set([
  'FAILURE',
  'TIMED_OUT',
  'CANCELLED',
  'ACTION_REQUIRED',
  'STARTUP_FAILURE',
  'ERROR',
])

/**
 * Collapses every check on a head into one word.
 *
 * A failure outranks a pending one, because a run still going cannot clear a
 * job that already failed and reporting the head as pending would invite a
 * wait for an answer that has arrived.
 */
export function rollup(checks: readonly RawCheck[]): ChecksState | null {
  if (checks.length === 0) return null

  const verdicts = checks.map((check) => check.conclusion ?? check.state ?? '')

  if (verdicts.some((verdict) => FAILED.has(verdict))) return 'failing'

  const running = checks.some(
    (check) =>
      (check.status !== undefined && check.status !== 'COMPLETED') ||
      check.state === 'PENDING' ||
      (check.conclusion === undefined && check.state === undefined),
  )

  return running ? 'pending' : 'passing'
}

/**
 * Reads the heading of the newest pass carrying one, matching on the first line
 * alone the way `poll.ts` does.
 *
 * The reviews arrive oldest first, so the last match is the current state of
 * the thread. A pass carrying neither heading is somebody reviewing by hand and
 * says nothing about whether the loop owes work.
 */
export function latestReview(
  reviews: readonly RawReview[],
): ReviewState | null {
  let state: ReviewState | null = null

  for (const review of reviews) {
    const first = (review.body ?? '').split('\n')[0]?.replace(/\r$/, '')
    if (first === REVIEW_OPEN) state = 'open'
    else if (first === REVIEW_CLOSED) state = 'closed'
  }

  return state
}

function parse<T>(text: string | null): T | null {
  if (text === null) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

/**
 * Reports the open pull requests in one target with their checks and the
 * heading their newest review pass carries.
 *
 * A list that failed and a target with no open pull request are separated
 * rather than collapsed, since reading the first as the second reports a target
 * as done when nothing was read at all. That is the failure mode the shell loop
 * this replaces had no way to surface.
 */
export async function readTargetPulls(
  path: string,
  opts: PullsOptions = {},
): Promise<TargetPulls> {
  const run = opts.run ?? runGh

  if (!isDirectory(path))
    return { kind: 'refused', path, reason: 'not-a-directory' }

  if (opts.run === undefined && Bun.which('gh') === null) {
    return { kind: 'refused', path, reason: 'gh-unavailable' }
  }

  const listed = parse<readonly RawPull[]>(
    await run(path, [
      'pr',
      'list',
      '--state',
      'open',
      '--json',
      'number,title,url,headRefOid,statusCheckRollup',
    ]),
  )

  if (listed === null) return { kind: 'refused', path, reason: 'list-failed' }

  const pulls = await Promise.all(
    listed
      .filter(
        (raw): raw is RawPull & { number: number } =>
          typeof raw.number === 'number',
      )
      .map(async (raw) => {
        // One query per pull request, so a review read that failed surfaces on
        // the thread it failed for rather than emptying the whole target.
        const reviews = parse<{ reviews?: readonly RawReview[] }>(
          await run(path, [
            'pr',
            'view',
            String(raw.number),
            '--json',
            'reviews',
          ]),
        )

        return {
          number: raw.number,
          title: raw.title ?? '',
          url: raw.url ?? '',
          head: raw.headRefOid ?? '',
          checks: rollup(raw.statusCheckRollup ?? []),
          review: reviews === null ? null : latestReview(reviews.reviews ?? []),
          reviewReadable: reviews !== null,
        }
      }),
  )

  return { kind: 'read', path, pulls }
}

/**
 * Reads every target, one at a time.
 *
 * The reads are serial rather than batched because each one spends a GitHub API
 * quota shared across all of them, and a wave running over a dozen targets that
 * fired them together would meet the secondary rate limit rather than an answer.
 */
export async function readPullsAcross(
  paths: readonly string[],
  opts: PullsOptions = {},
): Promise<readonly TargetPulls[]> {
  const reports: TargetPulls[] = []

  for (const path of paths) reports.push(await readTargetPulls(path, opts))

  return reports
}
