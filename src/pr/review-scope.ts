/**
 * The last state a review pass covered, read off the pass's own marker rather
 * than off the fields GitHub stamps when a review is submitted.
 *
 * `commit.oid` names whatever the pull request head was at the instant the
 * review was submitted, not the commit the session read. A push landing between
 * the read and the post moves that stamp onto a commit nobody reviewed, and the
 * next pass then scopes its delta past work no reader has seen. `submittedAt`
 * carries the same defect on the time axis. `review-pr` therefore writes the
 * commit it read and the instant it read it into the body itself, and this
 * module is the one place that marker is parsed.
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
 * The marker `review-pr` appends as the last line of every body it posts.
 *
 * The sha is bounded at git's own abbreviation range rather than pinned to 40,
 * since an abbreviated sha still names a commit and refusing one drops the pass
 * back to the stamp this exists to replace.
 *
 * Anchoring to a whole line is not on its own what keeps a quoted marker out.
 * It stops the inline form, where the surrounding backticks leave the trimmed
 * line unmatchable, and a marker shown alone inside a fenced block trims to
 * exactly this pattern. Position is what separates the two, which is why
 * `markerOf` reads one line rather than searching.
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
 *
 * Matched for equality on the first line alone. A prefix test also reaches
 * `## Review response`, which belongs to the reply family and would scope a
 * pass to whatever commit a worker's answer carried. The `\r` trim covers a
 * body composed in the GitHub web editor, which stores CRLF.
 */
function headingOf(body: string): ReviewHeading | undefined {
  const first = (body.split('\n')[0] ?? '').replace(/\r$/, '')
  return REVIEW_HEADINGS.find((heading) => heading === first)
}

/**
 * The marker a body carries, or undefined when it carries none this reader
 * trusts.
 *
 * The last non-empty line and no other. Searching the body for the last match
 * instead reads a marker the body was displaying rather than claiming: a pass
 * that shows the format on its own line inside a fenced block, and carries no
 * marker of its own because it predates this shipping, would hand the next
 * reader a covered commit taken from an illustration. That is the defect this
 * module exists to close, arriving by another route and just as silently.
 *
 * Position costs nothing, since Step 4 of `review-pr` puts the marker on the
 * last line of every body it writes, the `PUT` rewrite included. Trailing blank
 * lines are skipped rather than read as an absent marker, which is the one
 * thing the search was buying.
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
 * Resolves the newest UI verdict and the head it covered.
 *
 * Read off `reviews` like the code review family, since `review-ui` posts each
 * verdict as a pull request review. The first line is matched for equality so
 * `## UI review closed` is never taken for the open heading by prefix.
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
 * Whether a covered commit names the head. A marker may carry a short sha, so
 * coverage is a prefix match on the head.
 */
export function coversHead(commit: string, head: string): boolean {
  return commit !== '' && head !== '' && head.startsWith(commit)
}

/**
 * Resolves what the newest review pass covered.
 *
 * The newest pass rather than the newest marker: a thread whose latest pass
 * predates this mechanism reads through the fallback, and reaching back to an
 * older marked pass would report a commit a later pass has already moved past.
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
