import { describe, expect, it } from 'vitest'
import {
  diffPatternVerdict,
  sweepPatternVerdict,
} from '@/context/classify/patterns'

describe('diffPatternVerdict', () => {
  it('should flag a branch-narrated restatement as HISTORY', () => {
    const result = diffPatternVerdict(
      'canon/context/retrieval.md',
      'That row closed on `feature-corpus-and-answer-text`. The provision reads 535 characters now.',
    )

    expect(result.verdict).toBe('HISTORY')
    expect(result.quote).toBe('closed on')
  })

  it('should flag a repeated move as HISTORY', () => {
    const result = diffPatternVerdict(
      'canon/ARCHITECTURE.md',
      'Both counts moved again on `feature-cut-provisions-at-headings`, taking the total to 725.',
    )

    expect(result.verdict).toBe('HISTORY')
  })

  it('should flag a source file named in a wireframe as MOVE', () => {
    const result = diffPatternVerdict(
      'canon/wireframes/answer.md',
      'The word `Twelve` is typed, and `web/src/lib/replay.test.ts` fails when the recording stops holding twelve questions.',
    )

    expect(result.verdict).toBe('MOVE')
    expect(result.quote).toBe('`web/src/lib/replay.test.ts`')
  })

  it('should not apply the wireframe MOVE test outside a wireframe path', () => {
    const result = diffPatternVerdict(
      'canon/context/cli/audits.md',
      'The check reads `src/context/classify/patterns.ts` to build the record.',
    )

    expect(result.verdict).toBe('KEEP')
  })

  it('should keep a table row rewritten in place', () => {
    const result = diffPatternVerdict(
      'canon/context/retrieval.md',
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
      'annex/canon/context/e2e-annex-capture.md',
      'A rebuild after `rm -rf .next` with both variables unset served the local page. The cause was not isolated. Measured at `b93e8be` on 2026-09-14.',
    )

    expect(result.verdict).toBe('KEEP')
  })

  it('should not flag a plain measurement date with no narration verb', () => {
    const result = diffPatternVerdict(
      'canon/context/cli/audits.md',
      'The stage prints every entry it measured, reading the ceiling from the record itself, current as of 2026-09-01.',
    )

    expect(result.verdict).toBe('KEEP')
  })
})

describe('sweepPatternVerdict', () => {
  it('should flag a section carrying its own history as REWRITE', () => {
    const result = sweepPatternVerdict(
      'canon/context/cli/audits.md',
      '## The superseded-value sweep\n\nThe sweep used to key on the file, but it was retired in favor of keying on the value.',
    )

    expect(result.verdict).toBe('REWRITE')
  })

  it('should flag mechanism named in a wireframe section as MOVE', () => {
    const result = sweepPatternVerdict(
      'canon/wireframes/answer.md',
      '## Invalid\n\nRendered by `web/src/components/Answer.tsx`, which reads the state from the composer above it.',
    )

    expect(result.verdict).toBe('MOVE')
  })

  it('should keep a current, single-surface section', () => {
    const result = sweepPatternVerdict(
      'canon/DESIGN.md',
      '## Spacing\n\nFour steps: 4px, 8px, 16px, 32px, applied consistently across every surface.',
    )

    expect(result.verdict).toBe('KEEP')
  })

  it('should not flag a lone dated anchor inside an otherwise current section', () => {
    const result = sweepPatternVerdict(
      'canon/context/cli/audits.md',
      '## Coverage\n\nEvery testable claim names a check. Measured at `b93e8be` on 2026-09-14.',
    )

    expect(result.verdict).toBe('KEEP')
  })
})
