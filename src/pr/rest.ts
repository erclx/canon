/**
 * The REST shapes `canon pr` reads a pull request through, put into the shapes
 * its readers already take.
 *
 * A cloud session's GitHub proxy refuses GraphQL and serves REST, and every
 * `gh pr view` runs on GraphQL. The verbs therefore read the pulls, reviews,
 * and issue-comments endpoints, and this module is the one boundary where
 * those payloads meet the field names the rest of `src/pr/` was written
 * against.
 */
import type { ReviewRow } from '@/pr/review-scope'

/** One row of `repos/{owner}/{repo}/pulls/<n>` or of the pulls listing. */
export interface RestPull {
  readonly number?: number
  readonly body?: string | null
  readonly head?: { readonly ref?: string; readonly sha?: string }
  readonly base?: { readonly ref?: string }
  readonly mergeable_state?: string
}

/** One row of `repos/{owner}/{repo}/pulls/<n>/reviews`. */
export interface RestReview {
  readonly body?: string | null
  readonly commit_id?: string | null
  readonly submitted_at?: string | null
}

/** One row of `repos/{owner}/{repo}/issues/<n>/comments`. */
export interface RestComment {
  readonly html_url?: string
  readonly body?: string | null
}

/** The head branch, reported head, and base of the pull request a caller named. */
export interface PullIdentity {
  readonly number: number | undefined
  readonly branch: string
  readonly head?: string
  readonly base?: string
  readonly mergeState?: string
}

export type BranchPull =
  | { readonly kind: 'found'; readonly number: number }
  | {
      readonly kind: 'refused'
      readonly reason: 'gh-failed' | 'ambiguous-pull'
    }

/**
 * Spells `mergeable_state` the way GraphQL's `mergeStateStatus` spells it.
 *
 * The two vocabularies hold the same values in different cases, so the
 * mapping is a case change. `unknown` stays `UNKNOWN`, which `withMergeState`
 * already reads as not conflicted while GitHub computes the state lazily.
 */
export function mergeStateOf(state: string | undefined): string | undefined {
  return state === undefined || state === '' ? undefined : state.toUpperCase()
}

export function identityOf(row: RestPull): PullIdentity {
  const mergeState = mergeStateOf(row.mergeable_state)
  return {
    number: row.number,
    branch: row.head?.ref ?? '',
    ...(row.head?.sha !== undefined && { head: row.head.sha }),
    ...(row.base?.ref !== undefined && { base: row.base.ref }),
    ...(mergeState !== undefined && { mergeState }),
  }
}

/**
 * The one open pull request a branch carries.
 *
 * Two open pull requests on one head against different bases refuse rather
 * than resolving to the first, since the listing's order says nothing about
 * which one the caller meant.
 */
export function selectBranchPull(rows: readonly RestPull[]): BranchPull {
  const numbers = rows
    .map((row) => row.number)
    .filter((number): number is number => number !== undefined)
  if (numbers.length > 1) return { kind: 'refused', reason: 'ambiguous-pull' }
  const [number] = numbers
  return number === undefined
    ? { kind: 'refused', reason: 'gh-failed' }
    : { kind: 'found', number }
}

/**
 * A pending review carries no `submitted_at`, which reads as null the way the
 * GraphQL listing reported it.
 */
export function reviewRowOf(review: RestReview): ReviewRow {
  return {
    body: review.body ?? '',
    commit:
      review.commit_id === undefined || review.commit_id === null
        ? null
        : { oid: review.commit_id },
    submittedAt: review.submitted_at ?? null,
  }
}

/** `html_url` ends in the same `#issuecomment-<id>` anchor GraphQL's `url` did. */
export function commentRowOf(comment: RestComment): {
  readonly url?: string
  readonly body: string
} {
  return {
    ...(comment.html_url !== undefined && { url: comment.html_url }),
    body: comment.body ?? '',
  }
}

/**
 * Parses the output of `gh api --paginate --jq '.[] | @json'`, one compact
 * object per line across every page.
 *
 * A filter that reshapes each row makes `--paginate` emit one value per page
 * rather than one merged array, so a line per row is the form that survives
 * paging. A line that does not parse refuses the whole listing, since a list
 * short by one review reads as a thread missing its newest pass.
 */
export function parseJsonLines<T>(stdout: string): T[] | undefined {
  const rows: T[] = []
  for (const line of stdout.split('\n')) {
    if (line.trim() === '') continue
    try {
      rows.push(JSON.parse(line) as T)
    } catch {
      return undefined
    }
  }
  return rows
}
