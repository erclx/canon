/**
 * The last state a review pass covered, read off the pass's own marker, since
 * GitHub's `commit.oid` and `submittedAt` name the instant of the post and a
 * push between read and post would hide work. This module parses that marker.
 */

/** The two headings `review-pr` posts a pass under. */
export const REVIEW_HEADINGS = ['## Review', '## Review closed'] as const

export type ReviewHeading = (typeof REVIEW_HEADINGS)[number]

/** Whether the thread's newest pass still owes work on it. */
export type ReviewState = 'open' | 'closed' | 'none'

/** Where the covered state came from. */
export type ScopeSource =
  /** The pass wrote its own read-time marker, which is the authority. */
  | 'marker'
  /** A pass posted before the marker shipped, read off GitHub's own stamps. */
  | 'fallback'
  /** The thread carries no pass at all, so this is a first pass. */
  | 'none'

export interface ReviewScope {
  /** The heading of the newest pass, absent when the thread carries none. */
  readonly heading?: ReviewHeading
  /** The same fact as `heading`, collapsed for a caller that reads only state. */
  readonly state: ReviewState
  /** The commit the newest pass covered. */
  readonly commit?: string
  /** When that pass read the commit, present only under a marker. */
  readonly readAt?: string
  /** When GitHub recorded the pass, which trails `readAt` by the compose window. */
  readonly submittedAt?: string
  readonly source: ScopeSource
}

/** One row of `gh pr view --json reviews`. */
export interface ReviewRow {
  readonly body?: string
  readonly commit?: { readonly oid?: string } | null
  readonly submittedAt?: string | null
  /** GitHub's review state, `DISMISSED` once the operator withdrew the pass. */
  readonly state?: string | null
}

/**
 * What this reads out of `gh pr view`.
 *
 * Only `reviews` is named, so a caller may hand over a wider payload it fetched
 * for its own reasons without this module growing a field it never opens.
 */
export interface ReviewListing {
  readonly reviews?: readonly ReviewRow[]
}

/**
 * The marker `review-pr` appends as the last line of every body it posts. The
 * sha is bounded at git's abbreviation range, not pinned to 40, and a fenced
 * marker matches too, so position separates them and `markerOf` reads one line.
 */
const MARKER =
  /^<!--\s*review-pr:\s*commit=([0-9a-f]{7,40})\s+read-at=(\S+)\s*-->$/

/**
 * Loose enough to accept every stamp `date -u +%Y-%m-%dT%H:%M:%SZ` and
 * `toISOString` produce, strict enough that a body carrying prose in the field
 * falls back rather than handing a caller a value no date parser reads.
 */
const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/

/**
 * The heading a body opens with, or undefined when it opens with anything else.
 * Matched for equality on the first line, since a prefix test also reaches
 * `## Review response`. The `\r` trim covers CRLF from the GitHub web editor.
 */
function headingOf(body: string): ReviewHeading | undefined {
  const first = (body.split('\n')[0] ?? '').replace(/\r$/, '')
  return REVIEW_HEADINGS.find((heading) => heading === first)
}

/**
 * The marker a body carries, or undefined when it carries none this reader
 * trusts. Only the last non-empty line counts, since a search would take a
 * marker shown in a fenced block as claimed, and `review-pr` writes it last.
 */
function markerOf(
  body: string,
): { commit: string; readAt: string } | undefined {
  const lines = body.split('\n')

  let index = lines.length - 1
  while (index >= 0 && (lines[index] ?? '').trim() === '') index -= 1
  if (index < 0) return undefined

  const match = MARKER.exec((lines[index] ?? '').trim())
  if (match === null) return undefined

  const [, commit, readAt] = match
  if (commit === undefined || readAt === undefined) return undefined
  if (!ISO_8601.test(readAt)) return undefined

  return { commit, readAt }
}

/** The two headings `review-ui` posts a verdict under. */
export const UI_HEADINGS = ['## UI review', '## UI review closed'] as const

export type UiHeading = (typeof UI_HEADINGS)[number]

/** The four totals on a verdict's count line. */
export interface UiCounts {
  readonly failed: number
  readonly eyes: number
  readonly passed: number
  readonly notDriven: number
}

export interface UiScope {
  readonly heading?: UiHeading
  readonly state: ReviewState
  /** The head the verdict covered, a full or abbreviated sha. */
  readonly commit?: string
  /** The counts the verdict wrote, absent when its count line does not parse. */
  readonly counts?: UiCounts
  /** `marker` is the verdict's own record, `fallback` is GitHub's stamp. */
  readonly source: ScopeSource
}

/**
 * The marker `review-ui` writes as the last line of every verdict. It names the
 * head the pass drove, since the submission stamp moves onto a commit pushed
 * while the pass was driving.
 */
const UI_MARKER = /^<!--\s*review-ui:\s*head=([0-9a-f]{7,40})\s*-->$/

/**
 * The count line `review-ui`'s `post.md` fixes as the verdict's first line
 * under the heading. It is model-written prose, so a body that drifts from the
 * form reads as no counts and a caller treats that as unchecked.
 */
const UI_COUNTS =
  /^(\d+) failed · (\d+) need your eyes · (\d+) passed · (\d+) not driven$/

export function readUiCounts(body: string): UiCounts | undefined {
  for (const raw of body.split('\n').slice(1, 6)) {
    const match = UI_COUNTS.exec(raw.trim())
    if (match === null) continue
    const [, failed, eyes, passed, notDriven] = match.map(Number)
    if (
      failed === undefined ||
      eyes === undefined ||
      passed === undefined ||
      notDriven === undefined
    ) {
      return undefined
    }
    return { failed, eyes, passed, notDriven }
  }
  return undefined
}

function lastLine(body: string): string | undefined {
  const lines = body.split('\n')

  let index = lines.length - 1
  while (index >= 0 && (lines[index] ?? '').trim() === '') index -= 1
  if (index < 0) return undefined

  return (lines[index] ?? '').trim()
}

/**
 * Resolves the newest UI verdict and the head it covered, read off `reviews`
 * like the code family, since `review-ui` posts each verdict as a review. The
 * first line is matched for equality so a closed heading never reads as open.
 */
export function resolveUiScope(listing: ReviewListing): UiScope {
  let newest: { heading: UiHeading; row: ReviewRow } | undefined

  for (const row of listing.reviews ?? []) {
    const first = ((row.body ?? '').split('\n')[0] ?? '').replace(/\r$/, '')
    const heading = UI_HEADINGS.find((candidate) => candidate === first)
    if (heading !== undefined) newest = { heading, row }
  }

  if (newest === undefined) return { state: 'none', source: 'none' }

  const { heading, row } = newest
  const state: ReviewState = heading === '## UI review' ? 'open' : 'closed'
  const line = lastLine(row.body ?? '')
  const match = line === undefined ? null : UI_MARKER.exec(line)
  const marked = match?.[1]
  const counts = readUiCounts(row.body ?? '')
  const counted = counts === undefined ? {} : { counts }

  if (marked !== undefined) {
    return { heading, state, commit: marked, ...counted, source: 'marker' }
  }

  const oid = row.commit?.oid
  return {
    heading,
    state,
    ...(oid === undefined || oid === '' ? {} : { commit: oid }),
    ...counted,
    source: 'fallback',
  }
}

/**
 * The newest code pass and the newest UI pass, each only when its own marker
 * closes it, skipping any pass the operator dismissed. A body with no pass
 * heading never stands, nor does an older pass a newer one replaced.
 */
export function standingPasses(reviews: readonly ReviewRow[]): ReviewRow[] {
  let code: ReviewRow | undefined
  let ui: ReviewRow | undefined
  for (const row of reviews) {
    if (row.state === 'DISMISSED') continue
    const body = row.body ?? ''
    if (headingOf(body) !== undefined) code = row
    else if (resolveUiScope({ reviews: [row] }).state !== 'none') ui = row
  }

  const passes: ReviewRow[] = []
  if (code !== undefined && markerOf(code.body ?? '') !== undefined) {
    passes.push(code)
  }
  if (ui !== undefined && UI_MARKER.test(lastLine(ui.body ?? '') ?? '')) {
    passes.push(ui)
  }
  return passes
}

/**
 * Whether a covered commit names the head. A marker may carry a short sha, so
 * coverage is a prefix match on the head.
 */
export function coversHead(commit: string, head: string): boolean {
  return commit !== '' && head !== '' && head.startsWith(commit)
}

/**
 * Resolves what the newest review pass covered, the newest pass rather than the
 * newest marker: a thread whose latest pass predates the mechanism reads through
 * the fallback, and an older marked pass would report a commit since passed.
 */
export function resolveReviewScope(listing: ReviewListing): ReviewScope {
  let newest: { heading: ReviewHeading; row: ReviewRow } | undefined

  for (const row of listing.reviews ?? []) {
    const heading = headingOf(row.body ?? '')
    if (heading === undefined) continue
    newest = { heading, row }
  }

  if (newest === undefined) return { state: 'none', source: 'none' }

  const { heading, row } = newest
  const state: ReviewState = heading === '## Review' ? 'open' : 'closed'
  const submittedAt = row.submittedAt ?? undefined
  const stamped = submittedAt === undefined ? {} : { submittedAt }
  const marker = markerOf(row.body ?? '')

  if (marker !== undefined) {
    return {
      heading,
      state,
      commit: marker.commit,
      readAt: marker.readAt,
      ...stamped,
      source: 'marker',
    }
  }

  const oid = row.commit?.oid
  return {
    heading,
    state,
    ...(oid === undefined || oid === '' ? {} : { commit: oid }),
    ...stamped,
    source: 'fallback',
  }
}
