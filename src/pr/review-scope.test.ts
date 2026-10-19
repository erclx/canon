import { describe, expect, it } from 'vitest'
import {
  coversHead,
  type ReviewRow,
  resolveReviewScope,
  resolveUiScope,
} from '@/pr/review-scope'

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

/** An open pass in the restyled shape, nested evidence and folded confirmations. */
const RESTYLED_OPEN = `## Review

0 critical, 1 should-fix, 0 minor. Reviewed against project docs and the board.

**\`src/a.ts\`**

- **should-fix** ([line 3](https://example.com/a.ts#L3)): The guard never runs.
  - The caller returns first.
  - Fix: move the guard above the return.

<details>
<summary>Review focus, 1 checked</summary>

- The empty input: covered by \`a.test.ts\`

</details>

🤖 Reviewed by Claude Code`

/** A close in the restyled shape, a count line and one line per prior finding. */
const RESTYLED_CLOSED = `## Review closed

✅ 1 prior finding addressed at \`a0cf1a3\`. Re-reviewed the commits since \`5653721\`.

- **should-fix**, \`src/a.ts\`: the guard runs above the return

🤖 Reviewed by Claude Code`

describe('resolveReviewScope', () => {
  it('should read a restyled open pass as the open state off its marker', () => {
    const scope = resolveReviewScope({
      reviews: [review(`${RESTYLED_OPEN}\n\n${marker(READ)}`)],
    })

    expect([scope.heading, scope.state, scope.commit, scope.source]).toEqual([
      '## Review',
      'open',
      READ,
      'marker',
    ])
  })

  it('should read a restyled close as the closed state off its marker', () => {
    const scope = resolveReviewScope({
      reviews: [review(`${RESTYLED_CLOSED}\n\n${marker(READ)}`)],
    })

    expect([scope.heading, scope.state, scope.commit, scope.source]).toEqual([
      '## Review closed',
      'closed',
      READ,
      'marker',
    ])
  })

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

const UI_HEAD = '9b1f2c3d4e5f60718293a4b5c6d7e8f901234567'

function uiMarker(head: string): string {
  return `<!-- review-ui: head=${head} -->`
}

const UI_OPEN = '## UI review\n\nBox 2 failed.'
const UI_CLOSED = '## UI review closed\n\nEvery box passed.'

describe('resolveUiScope', () => {
  it('should report none when the thread carries no UI verdict', () => {
    const scope = resolveUiScope({ reviews: [review(CLOSED)] })

    expect(scope).toEqual({ state: 'none', source: 'none' })
  })

  it('should read the head off the marker on the last line', () => {
    const scope = resolveUiScope({
      reviews: [review(`${UI_CLOSED}\n${uiMarker(UI_HEAD)}`)],
    })

    expect(scope).toEqual({
      heading: '## UI review closed',
      state: 'closed',
      commit: UI_HEAD,
      source: 'marker',
    })
  })

  it('should read the marker a PUT rewrite left on the standing UI close', () => {
    // `PUT` keeps `commit.oid` at the head the close was first posted against
    // and replaces the body, so only the marker names the head the clean
    // re-pass drove.
    const rewritten = review(`${UI_CLOSED}\n${uiMarker(UI_HEAD)}`, STAMPED)
    const scope = resolveUiScope({ reviews: [rewritten] })

    expect(scope).toEqual({
      heading: '## UI review closed',
      state: 'closed',
      commit: UI_HEAD,
      source: 'marker',
    })
  })

  it('should take the newest UI verdict over an older one', () => {
    const scope = resolveUiScope({
      reviews: [
        review(`${UI_OPEN}\n${uiMarker(READ)}`),
        review(`${UI_CLOSED}\n${uiMarker(UI_HEAD)}`),
      ],
    })

    expect(scope.state).toBe('closed')
    expect(scope.commit).toBe(UI_HEAD)
  })

  it('should read a code review heading as no UI verdict', () => {
    const scope = resolveUiScope({
      reviews: [review(`${OPEN}\n${marker(READ)}`)],
    })

    expect(scope.state).toBe('none')
  })

  it('should fall back to the stamp when a verdict carries no marker', () => {
    const scope = resolveUiScope({ reviews: [review(UI_CLOSED, STAMPED)] })

    expect(scope).toEqual({
      heading: '## UI review closed',
      state: 'closed',
      commit: STAMPED,
      source: 'fallback',
    })
  })

  it('should ignore a marker that is not the last line', () => {
    const scope = resolveUiScope({
      reviews: [review(`${UI_CLOSED}\n${uiMarker(UI_HEAD)}\ntrailing prose`)],
    })

    expect(scope.source).toBe('fallback')
  })
})

describe('coversHead', () => {
  it('should cover a head the commit names in full', () => {
    expect(coversHead(UI_HEAD, UI_HEAD)).toBe(true)
  })

  it('should cover a head a short sha prefixes', () => {
    expect(coversHead(UI_HEAD.slice(0, 7), UI_HEAD)).toBe(true)
  })

  it('should read a close behind the head as not covering it', () => {
    expect(coversHead(READ, UI_HEAD)).toBe(false)
  })

  it('should not cover an empty head', () => {
    expect(coversHead(UI_HEAD, '')).toBe(false)
  })
})
