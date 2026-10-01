import { describe, expect, it } from 'vitest'
import { type ReviewRow, resolveReviewScope } from '@/pr/review-scope'

const READ = 'a0cf1a39aa1d0d510e16360e98a18129a8fddc78'
const STAMPED = '5653721cbb1d0d510e16360e98a18129a8fddc78'

const READ_AT = '2026-09-07T11:04:22Z'
const SUBMITTED_AT = '2026-09-07T11:06:41Z'

function marker(commit: string, readAt = READ_AT): string {
  return `<!-- review-pr: commit=${commit} read-at=${readAt} -->`
}

/** One `gh pr view --json reviews` row, stamped the way GitHub stamps one. */
function review(body: string, oid = STAMPED): ReviewRow {
  return { body, commit: { oid }, submittedAt: SUBMITTED_AT }
}

const OPEN = `## Review

0 critical, 1 should-fix, 0 minor.

🤖 Reviewed by Claude Code`

const CLOSED = `## Review closed

✅ Prior findings addressed.

🤖 Reviewed by Claude Code`

describe('resolveReviewScope', () => {
  it('should report a first pass when the thread carries no review', () => {
    expect(resolveReviewScope({ reviews: [] })).toEqual({
      state: 'none',
      source: 'none',
    })
  })

  it('should report a first pass when the listing carries no reviews key', () => {
    expect(resolveReviewScope({})).toEqual({ state: 'none', source: 'none' })
  })

  it('should read the commit off the marker rather than off the stamp', () => {
    const scope = resolveReviewScope({
      reviews: [review(`${OPEN}\n${marker(READ)}`)],
    })

    expect(scope).toEqual({
      heading: '## Review',
      state: 'open',
      commit: READ,
      readAt: READ_AT,
      submittedAt: SUBMITTED_AT,
      source: 'marker',
    })
  })

  it('should fall back to the stamp for a pass posted before the marker shipped', () => {
    const scope = resolveReviewScope({ reviews: [review(OPEN)] })

    expect(scope).toEqual({
      heading: '## Review',
      state: 'open',
      commit: STAMPED,
      submittedAt: SUBMITTED_AT,
      source: 'fallback',
    })
  })

  it('should report a close-out as the closed state', () => {
    const scope = resolveReviewScope({
      reviews: [review(`${CLOSED}\n${marker(READ)}`)],
    })

    expect(scope.heading).toBe('## Review closed')
    expect(scope.state).toBe('closed')
  })

  it('should read the marker a PUT rewrite left on the standing close-out', () => {
    // `PUT` replaces the body and leaves `commit.oid` pinned to the commit the
    // comment was first submitted against, which is the sibling defect the
    // marker closes as a side effect.
    const rewritten = review(`${CLOSED}\n${marker(READ)}`, STAMPED)
    const scope = resolveReviewScope({ reviews: [rewritten] })

    expect(scope.commit).toBe(READ)
    expect(scope.source).toBe('marker')
  })

  it('should read the newest pass rather than the newest marker', () => {
    const scope = resolveReviewScope({
      reviews: [review(`${OPEN}\n${marker(READ)}`), review(CLOSED)],
    })

    expect(scope).toEqual({
      heading: '## Review closed',
      state: 'closed',
      commit: STAMPED,
      submittedAt: SUBMITTED_AT,
      source: 'fallback',
    })
  })

  it('should ignore a review posted under a reply-family heading', () => {
    const scope = resolveReviewScope({
      reviews: [
        review(`${OPEN}\n${marker(READ)}`),
        review('## Review response\n\nAccepted as recorded.'),
      ],
    })

    expect(scope.commit).toBe(READ)
  })

  // The UI pass posts its own family as a pull request review too, after the
  // code pass, and the code family's state must read through it unchanged.
  it('should ignore a review posted under a UI-family heading', () => {
    const scope = resolveReviewScope({
      reviews: [
        review(`${OPEN}\n${marker(READ)}`),
        review(
          `## UI review closed\n\nEvery box passed.\n\n🤖 Reviewed by Claude Code`,
        ),
      ],
    })

    expect(scope.state).toBe('open')
    expect(scope.commit).toBe(READ)
  })

  it('should read a heading a web-composed body stored with CRLF', () => {
    const scope = resolveReviewScope({
      reviews: [review(`## Review closed\r\n\r\n✅ Nothing owed.`)],
    })

    expect(scope.heading).toBe('## Review closed')
  })

  it('should ignore a marker quoted inside a finding', () => {
    const quoted = `## Review

- **minor**: the body should end with \`${marker(READ)}\` and does not.

🤖 Reviewed by Claude Code`

    const scope = resolveReviewScope({ reviews: [review(quoted)] })

    expect(scope.commit).toBe(STAMPED)
    expect(scope.source).toBe('fallback')
  })

  it('should ignore a marker a body displays on its own line', () => {
    // The shape the inline case above does not reach. A fenced block trims to
    // exactly the pattern, so a body that shows the format and carries no
    // marker of its own would otherwise hand the next reader a covered commit
    // taken from an illustration.
    const shown = `## Review

- **should-fix**: end the body with the marker:

\`\`\`markdown
${marker(READ)}
\`\`\`

🤖 Reviewed by Claude Code`

    const scope = resolveReviewScope({ reviews: [review(shown)] })

    expect(scope.commit).toBe(STAMPED)
    expect(scope.source).toBe('fallback')
  })

  it('should ignore a marker sitting above the footer rather than below it', () => {
    const misplaced = `## Review

${marker(READ)}

🤖 Reviewed by Claude Code`

    const scope = resolveReviewScope({ reviews: [review(misplaced)] })

    expect(scope.commit).toBe(STAMPED)
    expect(scope.source).toBe('fallback')
  })

  it('should fall back when the marker carries an unreadable instant', () => {
    const scope = resolveReviewScope({
      reviews: [
        review(`${OPEN}\n<!-- review-pr: commit=${READ} read-at=now -->`),
      ],
    })

    expect(scope.commit).toBe(STAMPED)
    expect(scope.source).toBe('fallback')
  })

  it('should read a marker sitting above trailing blank lines', () => {
    const scope = resolveReviewScope({
      reviews: [review(`${OPEN}\n${marker(READ)}\n\n`)],
    })

    expect(scope.commit).toBe(READ)
  })

  it('should carry no commit when a pre-marker pass was stamped with none', () => {
    const scope = resolveReviewScope({
      reviews: [{ body: OPEN, commit: null, submittedAt: SUBMITTED_AT }],
    })

    expect(scope).toEqual({
      heading: '## Review',
      state: 'open',
      submittedAt: SUBMITTED_AT,
      source: 'fallback',
    })
  })
})
