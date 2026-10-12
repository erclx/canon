import { type BodyLine, LINK, maskDisplayed } from '@/markdown/scan'

export interface ColonFinding {
  readonly line: number
  /** Zero-based, the colon itself. */
  readonly column: number
  /** The whole source line, so a reader can match it against new text. */
  readonly text: string
  /**
   * The run of non-space characters ending at the colon. A hook matches it
   * against new text, since `column` is a UTF-16 offset that a reader counting
   * code points would misplace after an emoji.
   */
  readonly lead: string
}

const HEADING = /^#{1,6}\s/
const TABLE_ROW = /^\s*\|/
const LIST_MARKER = /^\s*(?:[-*+]|\d+[.)])\s+/
const QUOTE_MARKER = /^(?:\s*>\s?)+/

/** A colon followed by whitespace and more text, ruling out `10:30` and a scheme. */
const COLON = /:(?=\s+\S)/g

const BOLD_LABEL = /^(\*\*|__)[^*_]+\1$/

/** Blanks a span while holding its width, so a column stays where it was. */
function blank(match: string): string {
  return ' '.repeat(match.length)
}

/**
 * Whether the text before a line's first colon is a label rather than a
 * clause: the lead of a list item, or a prefix that is only emphasis and a
 * masked code span.
 */
function isLabel(prefix: string, listItem: boolean): boolean {
  if (BOLD_LABEL.test(prefix.trim())) return true

  const words = prefix.replace(/[*_]/g, ' ').trim()
  if (words === '') return true
  return listItem && words.split(/\s+/).length <= 4
}

/**
 * Finds a colon joining two clauses in the middle of a prose sentence.
 *
 * A heading, a table row, a fence, a code span, a link, and a line-final colon
 * are left alone, and so is the first colon of a list item or of a line opening
 * on a bold or code label. The measure is advisory, because a colon is
 * sometimes right and the corpus count shows a gate would be a sweep nobody
 * asked for.
 */
export function findColons(lines: readonly BodyLine[]): ColonFinding[] {
  const found: ColonFinding[] = []

  for (const line of lines) {
    if (line.fenced || HEADING.test(line.text) || TABLE_ROW.test(line.text)) {
      continue
    }

    const masked = maskDisplayed(line.text.replace(LINK, blank))
    const quote = QUOTE_MARKER.exec(masked)?.[0] ?? ''
    const marker = LIST_MARKER.exec(masked.slice(quote.length))?.[0] ?? ''
    const start = quote.length + marker.length
    let labelled = false

    for (const match of masked.matchAll(COLON)) {
      if (match.index < start) continue

      if (!labelled) {
        labelled = true
        if (isLabel(masked.slice(start, match.index), marker !== '')) continue
      }

      found.push({
        line: line.number,
        column: match.index,
        text: line.text,
        lead: line.text.slice(0, match.index).replace(/^.*\s/, ''),
      })
    }
  }

  return found
}
