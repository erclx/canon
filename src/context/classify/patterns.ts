/**
 * Regex layer for the doc classifier, ported from the groundwork spike at
 * `.canon/groundwork/93-canonical-doc-drift/scripts/heuristic.py`. It never
 * needs a model installed, so it is the layer that always runs.
 *
 * Diff mode reads one changed chunk and answers KEEP, HISTORY, or MOVE. It
 * never answers REPLACE, since telling a restated figure from a genuinely new
 * one needs the section the hunk landed in, which the model layer reads and
 * this one does not. Sweep mode reads one whole section and answers KEEP,
 * REWRITE, or MOVE, collapsing REPLACE and HISTORY the way the sweep prompt
 * does, since a section already carries its own history in view.
 */

export type DiffVerdict = 'KEEP' | 'REPLACE' | 'HISTORY' | 'MOVE'
export type SweepVerdict = 'KEEP' | 'REWRITE' | 'MOVE'

export interface PatternVerdict<V extends string> {
  readonly verdict: V
  /** Absent on KEEP, since nothing decided against the text. */
  readonly quote?: string
  readonly reason: string
}

/**
 * Narrates how a fact got here rather than stating it: a branch or PR name, a
 * closed or retired marker, a review-pass story. Ported from
 * `heuristic.py`'s `NARRATION` pattern with one change: the bare
 * `on \d{4}-\d{2}-\d{2}` alternative is dropped.
 *
 * That alternative was measured to false-flag a gotcha ending "Measured at
 * `<sha>` on <date>.", a dating anchor both prompts call correct on a current
 * statement. Every tuned hunk the bare date branch caught also carries a
 * narration verb elsewhere in the same text (`closed on`, `moved again`,
 * `did not survive`), so dropping it costs no measured catch and removes the
 * one measured false flag.
 */
const NARRATION =
  /moved (again|twice|on)|has since|at this branch|on `feat|Measured in PR|did not survive|the operator picked|picked arm|\barm \d|closed on|was retired|no longer|used to|\bround\b|a review pass|this pass/i

/**
 * A source-file path inside prose, the shape of implementation detail landing
 * on a surface that should describe layout and intent instead. Ported
 * verbatim from `heuristic.py`.
 */
const MECHANISM_IN_WIREFRAME = /`[\w./-]+\.(tsx?|py|css|spec\.ts)`/

function narrationQuote(text: string): string | undefined {
  return text.match(NARRATION)?.[0]
}

/**
 * Classifies one diff-mode chunk from its added text alone.
 *
 * `file` decides whether the wireframe-only MOVE test applies. A file argument
 * rather than a boolean matches `run.ts`'s other call sites, which hold the
 * path and not a pre-computed flag.
 */
export function diffPatternVerdict(
  file: string,
  added: string,
): PatternVerdict<DiffVerdict> {
  const quote = narrationQuote(added)
  if (quote !== undefined) {
    return { verdict: 'HISTORY', quote, reason: 'narrates how this got here' }
  }

  if (file.includes('wireframes/')) {
    const match = added.match(MECHANISM_IN_WIREFRAME)
    if (match) {
      return {
        verdict: 'MOVE',
        quote: match[0],
        reason: 'names a source file, which is implementation detail',
      }
    }
  }

  return { verdict: 'KEEP', reason: 'no narration or wrong-surface pattern' }
}

/**
 * Classifies one sweep-mode section from its whole body.
 *
 * REWRITE stands in for both REPLACE and HISTORY, matching `sweep-v1.md`'s
 * own three-verdict vocabulary: a section already shows its own history in
 * full view, so the model layer does not need the diff-mode split and the
 * regex layer follows it.
 */
export function sweepPatternVerdict(
  file: string,
  body: string,
): PatternVerdict<SweepVerdict> {
  const quote = narrationQuote(body)
  if (quote !== undefined) {
    return {
      verdict: 'REWRITE',
      quote,
      reason: 'carries its own history rather than the current state alone',
    }
  }

  if (file.includes('wireframes/')) {
    const match = body.match(MECHANISM_IN_WIREFRAME)
    if (match) {
      return {
        verdict: 'MOVE',
        quote: match[0],
        reason: 'names a source file, which is implementation detail',
      }
    }
  }

  return { verdict: 'KEEP', reason: 'no narration or wrong-surface pattern' }
}
