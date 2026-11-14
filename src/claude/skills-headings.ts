/**
 * The citation shape that sends a reader to a named section of the consuming
 * project's own `CLAUDE.md`, which a shipped body cannot rely on, since no
 * check can read a target's root file and the section rarely exists there.
 *
 * A `See` or `per`, in either case, then anything up to a period, then ` in `
 * and a backticked `CLAUDE.md`. The verbs separate a citation from a mention,
 * and the period stops the match at a sentence boundary. A backtick is not a
 * boundary, since a named heading is itself backticked. There is no exemption
 * marker, since the target does not resolve for the reader holding the body.
 */
const HEADING_CITATION = /\b(?:see|per)\b[^.]* in `CLAUDE\.md`/i

export interface HeadingCitation {
  readonly file: string
  /** One-based, matching the `file:line` form a reader clicks. */
  readonly line: number
  /** The whole line, so a report names what has to be rephrased. */
  readonly text: string
}

/**
 * Every line in one body carrying the banned citation.
 *
 * The unit is the line rather than the match, since a report names a line for
 * rephrasing and two hits on one line would arrive as identical entries.
 *
 * The corpus walk is deliberately absent. Keeping the shape separate from the
 * tree read is what lets the pattern be tested against a string rather than
 * against a fixture, the way `citationsIn` splits the same seam in
 * `skills-reach.ts`.
 */
export function headingCitationsIn(
  file: string,
  text: string,
): HeadingCitation[] {
  const citations: HeadingCitation[] = []

  for (const [index, line] of text.split('\n').entries()) {
    if (!HEADING_CITATION.test(line)) continue

    citations.push({ file, line: index + 1, text: line })
  }

  return citations
}
