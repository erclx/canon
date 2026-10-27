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

/** A colon followed by whitespace, which a masked code span leaves behind. */
const LABEL_COLON = /:\s/

const BOLD_LABEL = /^(\*\*|__)[^*_]+\1$/

/** What may stand in a lead once its code spans and links are masked. */
const CONNECTIVE = /\b(?:and|or|to)\b|,/g

/** Blanks a span while holding its width, so a column stays where it was. */
function blank(match: string): string {
  return ' '.repeat(match.length)
}

/**
 * Whether the text before a line's first colon is a label rather than a
 * clause: the lead of a list item, or a prefix that is only emphasis and a
 * masked code span. A list item's lead also reads as a label at any length
 * when only code spans, links, commas, and `and`, `or`, or `to` stand in it,
 * which is a file entry naming several paths.
 */
function isLabel(prefix: string, listItem: boolean): boolean {
  if (BOLD_LABEL.test(prefix.trim())) return true

  const words = prefix.replace(/[*_]/g, ' ').trim()
  if (words === '') return true
  if (!listItem) return false
  if (words.replace(CONNECTIVE, ' ').trim() === '') return true
  return words.split(/\s+/).length <= 4
}

interface Entry {
  readonly line: BodyLine
  readonly masked: string
  readonly start: number
  /** Width of the quote marker and the item's own leading whitespace. */
  readonly indent: number
  readonly quote: string
  readonly isItem: boolean
  /** Matches at or past the content start, the only ones a line can report. */
  readonly colons: readonly RegExpExecArray[]
  /** A colon stands past the content start, even with only a masked span after it. */
  readonly labelColon: boolean
  /** Items sharing one list at one indent, shared by reference. */
  group?: Entry[]
}

/**
 * Collects consecutive items at one indent into a list. A blank line, a
 * heading, or a change of quote depth ends every open list, and a deeper child
 * neither joins its parent's list nor ends it.
 */
function groupItems(entries: readonly Entry[]): void {
  const open = new Map<number, Entry[]>()
  let quote = ''

  for (const entry of entries) {
    if (entry.line.fenced) continue

    const empty = entry.masked.slice(entry.quote.length).trim() === ''
    if (entry.quote !== quote || empty || HEADING.test(entry.line.text)) {
      open.clear()
    }
    quote = entry.quote
    if (!entry.isItem) continue

    for (const level of open.keys()) {
      if (level > entry.indent) open.delete(level)
    }

    const group = open.get(entry.indent) ?? []
    open.set(entry.indent, group)
    group.push(entry)
    entry.group = group
  }
}

/** Whether the item sits in a list of two or more where every item has a colon. */
function uniform(entry: Entry): boolean {
  const group = entry.group
  return (
    group !== undefined &&
    group.length >= 2 &&
    group.every((item) => item.labelColon)
  )
}

/**
 * Finds a colon joining two clauses in the middle of a prose sentence.
 *
 * A heading, a table row, a fence, a code span, a link, and a line-final colon
 * are left alone, and so is the first colon of a list item or of a line opening
 * on a bold or code label, and of every item in a list where each one carries a
 * colon. The measure is advisory, because a colon is sometimes right and the
 * corpus count shows a gate would be a sweep nobody asked for.
 */
export function findColons(lines: readonly BodyLine[]): ColonFinding[] {
  const entries: Entry[] = lines.map((line) => {
    const masked = maskDisplayed(line.text.replace(LINK, blank))
    const quote = QUOTE_MARKER.exec(masked)?.[0] ?? ''
    const marker = LIST_MARKER.exec(masked.slice(quote.length))?.[0] ?? ''
    const start = quote.length + marker.length
    const skipped =
      line.fenced || HEADING.test(line.text) || TABLE_ROW.test(line.text)

    return {
      line,
      masked,
      start,
      indent: quote.length + marker.length - marker.trimStart().length,
      quote: quote.replace(/\s/g, ''),
      isItem: !skipped && marker !== '',
      labelColon: !skipped && LABEL_COLON.test(masked.slice(start)),
      colons: skipped
        ? []
        : [...masked.matchAll(COLON)].filter((match) => match.index >= start),
    }
  })

  groupItems(entries)

  const found: ColonFinding[] = []

  for (const entry of entries) {
    const { line, masked, start } = entry
    let labelled = false

    for (const match of entry.colons) {
      if (!labelled) {
        labelled = true
        if (
          isLabel(masked.slice(start, match.index), entry.isItem) ||
          (entry.isItem && uniform(entry))
        ) {
          continue
        }
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
