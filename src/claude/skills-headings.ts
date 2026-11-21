/**
 * The citation shape that sends a reader to a named section of the consuming
 * project's own `CLAUDE.md`, which a shipped body cannot rely on. A `See` or
 * `per` separates a citation from a mention, and a period ends the match.
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
 * Every line in one body carrying the banned citation. The unit is the line,
 * since two hits on one line would arrive as identical entries. The corpus walk
 * is absent so the pattern can be tested against a string.
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
