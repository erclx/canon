import { describe, expect, it } from 'vitest'
import {
  commentRowOf,
  identityOf,
  mergeStateOf,
  parseJsonLines,
  reviewRowOf,
  selectBranchPull,
} from '@/pr/rest'

const HEAD = 'a0cf1a39aa1d0d510e16360e98a18129a8fddc78'

function pull(overrides: Record<string, unknown> = {}) {
  return {
    number: 7,
    head: { ref: 'feat/x', sha: HEAD },
    base: { ref: 'main' },
    mergeable_state: 'clean',
    ...overrides,
  }
}

describe('mergeStateOf', () => {
  it('should map dirty to the DIRTY the conflicted reading branches on', () => {
    expect(mergeStateOf('dirty')).toBe('DIRTY')
  })

  it('should keep unknown as UNKNOWN rather than reading it as clean', () => {
    expect(mergeStateOf('unknown')).toBe('UNKNOWN')
  })

  it('should read an absent state as absent', () => {
    expect(mergeStateOf(undefined)).toBeUndefined()
  })
})

describe('identityOf', () => {
  it('should read the number, branch, head, and merge state off one pull row', () => {
    expect(identityOf(pull({ mergeable_state: 'dirty' }))).toEqual({
      number: 7,
      branch: 'feat/x',
      head: HEAD,
      mergeState: 'DIRTY',
    })
  })

  it('should leave the branch empty when the row carries no head ref', () => {
    expect(identityOf(pull({ head: {} })).branch).toBe('')
  })
})

describe('selectBranchPull', () => {
  it('should take the one open pull request on the branch', () => {
    expect(selectBranchPull([pull()])).toEqual({ kind: 'found', number: 7 })
  })

  it('should refuse as ambiguous when two open pull requests share the branch', () => {
    const rows = [pull(), pull({ number: 8, base: { ref: 'release' } })]

    expect(selectBranchPull(rows)).toEqual({
      kind: 'refused',
      reason: 'ambiguous-pull',
    })
  })

  it('should refuse as gh-failed when no pull request is open on the branch', () => {
    expect(selectBranchPull([])).toEqual({
      kind: 'refused',
      reason: 'gh-failed',
    })
  })
})

describe('reviewRowOf', () => {
  it('should carry the submission stamps in the shape the scope reader takes', () => {
    const row = reviewRowOf({
      body: '## Review',
      commit_id: HEAD,
      submitted_at: '2026-10-03T10:00:00Z',
    })

    expect(row).toEqual({
      body: '## Review',
      commit: { oid: HEAD },
      submittedAt: '2026-10-03T10:00:00Z',
    })
  })

  it('should read a pending review with no stamp as unsubmitted', () => {
    expect(reviewRowOf({ body: '', commit_id: HEAD }).submittedAt).toBeNull()
  })
})

describe('commentRowOf', () => {
  it('should carry the html address as the url the evidence reader keys on', () => {
    expect(
      commentRowOf({
        html_url: 'https://github.com/o/r/pull/7#issuecomment-100',
        body: 'b',
      }),
    ).toEqual({
      url: 'https://github.com/o/r/pull/7#issuecomment-100',
      body: 'b',
    })
  })
})

describe('parseJsonLines', () => {
  it('should parse one compact object per line across pages', () => {
    expect(parseJsonLines('{"a":1}\n{"a":2}\n\n{"a":3}\n')).toEqual([
      { a: 1 },
      { a: 2 },
      { a: 3 },
    ])
  })

  it('should read an empty listing as an empty list', () => {
    expect(parseJsonLines('')).toEqual([])
  })

  it('should refuse the whole listing when one line is not JSON', () => {
    expect(parseJsonLines('{"a":1}\nnot json\n')).toBeUndefined()
  })
})
