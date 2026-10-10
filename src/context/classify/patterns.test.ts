import { describe, expect, it } from 'vitest'
import {
  diffPatternVerdict,
  sweepPatternVerdict,
} from '@/context/classify/patterns'

describe('diffPatternVerdict', () => {
  it('should flag a branch-narrated restatement as HISTORY', () => {
    const result = diffPatternVerdict(
      'That row closed on `feature-corpus-and-answer-text`. The provision reads 535 characters now.',
    )

    expect(result.verdict).toBe('HISTORY')
    expect(result.quote).toBe('closed on')
  })

  it('should flag a repeated move as HISTORY', () => {
    const result = diffPatternVerdict(
      'Both counts moved again on `feature-cut-provisions-at-headings`, taking the total to 725.',
    )

    expect(result.verdict).toBe('HISTORY')
  })

  it('should keep a table row rewritten in place', () => {
    const result = diffPatternVerdict(
      '| Consolidated | 585 | 587 | `art_3` |',
    )

    expect(result.verdict).toBe('KEEP')
  })

  it('should not flag a lone dated commit anchor as HISTORY', () => {
    // Measured false flag from the groundwork spike (hunk 19 of
    // `labels.json`): a gotcha ending in a dating anchor, not a narration of
    // how the fact got here. `heuristic.py`'s bare `on \d{4}-\d{2}-\d{2}`
    // branch caught this by accident, and the ported pattern drops it.
    const result = diffPatternVerdict(
      'A rebuild after `rm -rf .next` with both variables unset served the local page. The cause was not isolated. Measured at `b93e8be` on 2026-09-14.',
    )

    expect(result.verdict).toBe('KEEP')
  })

  it('should not flag a plain measurement date with no narration verb', () => {
    const result = diffPatternVerdict(
      'The stage prints every entry it measured, reading the ceiling from the record itself, current as of 2026-09-01.',
    )

    expect(result.verdict).toBe('KEEP')
  })
})

describe('sweepPatternVerdict', () => {
  it('should flag a section carrying its own history as REWRITE', () => {
    const result = sweepPatternVerdict(
      '## The superseded-value sweep\n\nThe sweep used to key on the file, but it was retired in favor of keying on the value.',
    )

    expect(result.verdict).toBe('REWRITE')
  })

  it('should keep a current, single-surface section', () => {
    const result = sweepPatternVerdict(
      '## Spacing\n\nFour steps: 4px, 8px, 16px, 32px, applied consistently across every surface.',
    )

    expect(result.verdict).toBe('KEEP')
  })

  it('should not flag a lone dated anchor inside an otherwise current section', () => {
    const result = sweepPatternVerdict(
      '## Coverage\n\nEvery testable claim names a check. Measured at `b93e8be` on 2026-09-14.',
    )

    expect(result.verdict).toBe('KEEP')
  })
})
