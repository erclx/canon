/**
 * The citation shape that sends a reader to a named section of the consuming
 * project's own `CLAUDE.md`.
 *
 * A shipped body reaches a target through the plugin cache, and no `CLAUDE.md`
 * in this repository or in any known target carries the section these lines
 * named. The pointer resolves to nothing, which a session answers by guessing
 * the rule or dropping it, so the shape is banned rather than repaired one
 * body at a time.
 *
 * It is a prose pattern rather than a resolution, because no check can read a
 * target's own root file. A `See` or a `per`, then anything up to a period,
 * then ` in ` and a backticked `CLAUDE.md`. The two verbs are what separate a
 * citation from a mention: dropping them returns five extra lines that name
 * the file without pointing into it, and the period is what stops the match at
 * a sentence boundary so a body discussing the file two sentences earlier does
 * not fail.
 *
 * The period is the only boundary, and excluding a backtick alongside it was
 * the first shape. It reads as a tighter bound and is a hole, because
 * `markdown.md` has a body backtick a named thing, so the natural spelling of
 * the citation is `` See the `Parallel sessions` heading in `CLAUDE.md` `` and
 * a class stopping at the first backtick never reaches the file. That heading
 * was real in this repository's own root file when the check was written. Both classes returned the same
 * twenty lines over `claude/skills/` at the stamp, so the backtick exclusion
 * was carrying nothing and hiding the spelling an author would reach for.
 *
 * Both verbs match in either case. The measured corpus spelled them `See` and
 * `per` and the insensitive form returned the identical twenty hits with no
 * false positive, so it costs nothing and catches a sentence-initial `Per`.
 *
 * A later body phrasing a legitimate reference this way fails the check and
 * changes its phrasing. There is no exemption marker, since the point is that
 * the target does not resolve for the reader who holds the body.
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
