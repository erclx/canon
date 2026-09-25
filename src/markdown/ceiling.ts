import { basename } from 'node:path'
import { bodyLines } from '@/markdown/scan'
import { CHECKPOINTS, documentHeight } from '@/markdown/structure'

/**
 * The marker exempting one document from the ceiling, written as a whole line
 * outside a fence and naming a reason.
 *
 * The whole line rather than anywhere on it, so a standard quoting the marker
 * inside a code span to document it does not exempt itself. A marker with no
 * reason does not count, for the reason `isMarked` in `src/exempt-marker.ts`
 * gives: a bare token reads as a line that meant to say something and did not.
 */
const EXEMPT_MARKER = /^<!--\s*canon-length-exempt:[ \t]*(\S.*?)\s*-->$/

/**
 * A changelog is exempt by name because the release tool rewrites it and would
 * not keep a marker in place. A committed list of exempt paths was the
 * alternative, and it turns every rename into a second edit with nothing to
 * check the list against the tree.
 */
const CHANGELOG = 'CHANGELOG.md'
const CHANGELOG_REASON = 'CHANGELOG.md is written by the release tool'

export interface CeilingDocument {
  readonly rel: string
  readonly source: string
}

export interface CeilingFinding {
  readonly rel: string
  readonly renderedLines: number
  /** The stated reason, or null where the document is not exempt. */
  readonly exempt: string | null
}

/** The reason a document is exempt from the ceiling, or null where it is not. */
export function lengthExemption(rel: string, source: string): string | null {
  if (basename(rel) === CHANGELOG) return CHANGELOG_REASON

  for (const line of bodyLines(source)) {
    if (line.fenced) continue
    const match = EXEMPT_MARKER.exec(line.text.trim())
    if (match) return match[1]
  }

  return null
}

/**
 * Every document past the ceiling, longest first, exempt ones included with
 * their reason so a report can count them rather than hide them.
 */
export function ceilingFindings(
  documents: readonly CeilingDocument[],
): CeilingFinding[] {
  return documents
    .map(({ rel, source }) => ({
      rel,
      renderedLines: documentHeight(source),
      source,
    }))
    .filter(({ renderedLines }) => renderedLines > CHECKPOINTS.ceiling)
    .map(({ rel, renderedLines, source }) => ({
      rel,
      renderedLines,
      exempt: lengthExemption(rel, source),
    }))
    .sort((a, b) => b.renderedLines - a.renderedLines)
}
