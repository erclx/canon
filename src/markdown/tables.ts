import { type BodyLine, visibleText } from '@/markdown/scan'
import { LIST_ITEM, TABLE_ROW, TABLE_SEPARATOR } from '@/markdown/structure'

/** The most visible characters one table cell may hold. */
export const TABLE_CELL = 120

/** The most body rows a table may carry before it splits into groups. */
export const TABLE_ROWS = 8

/** The longest unbroken run a code span in a table cell may carry. */
export const TABLE_TOKEN = 30

export type TableKind =
  | 'table-cell'
  | 'table-rows'
  | 'table-then-list'
  | 'table-token'

export interface TableFinding {
  readonly kind: TableKind
  /** The row holding the cell or span, the header for a row count, or the list's first item. */
  readonly line: number
  /** What was measured, or null for a trailing list, which is a shape rather than a count. */
  readonly value: number | null
  readonly limit: number | null
}

/**
 * The body of every code span in a cell, read after link destinations are
 * dropped, since only a link's label renders.
 */
export function codeSpans(cell: string): string[] {
  return (cell.replace(/\]\([^)]*\)/g, ']').match(/`[^`]+`/g) ?? []).map(
    (span) => span.slice(1, -1),
  )
}

/**
 * The longest whitespace-free run in a code span. A preview also breaks a span
 * after a hyphen or a slash, but a run this long still splits mid-token or
 * widens its column, so whitespace is the break this counts.
 */
export function unbrokenRun(span: string): number {
  return Math.max(...span.split(/\s+/).map((part) => part.length))
}

/** Splits a row on its unescaped pipes, dropping the outer two. */
function cellsOf(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/(?<!\\)\|$/, '')
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim().replaceAll('\\|', '|'))
}

/**
 * Every breach of the four table limits, in line order.
 *
 * A table is a run of pipe rows whose second row is a delimiter, the shape a
 * renderer draws. Pipe lines with no delimiter render as paragraph text, and a
 * fenced line is an example, so neither is measured. The limits are a
 * 120-character cell, 8 body rows, a list as the next block, and a code span
 * holding a run past 30 characters. Every finding reports and none gates.
 */
export function tableFindings(lines: readonly BodyLine[]): TableFinding[] {
  const found: TableFinding[] = []
  let index = 0

  while (index < lines.length) {
    const header = lines[index]
    const delimiter = lines[index + 1]
    if (
      header.fenced ||
      !TABLE_ROW.test(header.text) ||
      delimiter === undefined ||
      delimiter.fenced ||
      !TABLE_SEPARATOR.test(delimiter.text)
    ) {
      index++
      continue
    }

    const tableRows = [header]
    let end = index + 2
    while (
      end < lines.length &&
      !lines[end].fenced &&
      TABLE_ROW.test(lines[end].text)
    ) {
      tableRows.push(lines[end])
      end++
    }

    for (const row of tableRows) {
      for (const cell of cellsOf(row.text)) {
        const length = visibleText(cell).length
        if (length > TABLE_CELL) {
          found.push({
            kind: 'table-cell',
            line: row.number,
            value: length,
            limit: TABLE_CELL,
          })
        }
        for (const span of codeSpans(cell)) {
          const run = unbrokenRun(span)
          if (run > TABLE_TOKEN) {
            found.push({
              kind: 'table-token',
              line: row.number,
              value: run,
              limit: TABLE_TOKEN,
            })
          }
        }
      }
    }

    const bodyRows = tableRows.length - 1
    if (bodyRows > TABLE_ROWS) {
      found.push({
        kind: 'table-rows',
        line: header.number,
        value: bodyRows,
        limit: TABLE_ROWS,
      })
    }

    let next = end
    while (next < lines.length && lines[next].text.trim() === '') next++
    const following = lines[next]
    if (
      following !== undefined &&
      !following.fenced &&
      LIST_ITEM.test(following.text)
    ) {
      found.push({
        kind: 'table-then-list',
        line: following.number,
        value: null,
        limit: null,
      })
    }

    index = end
  }

  return found.sort((a, b) => a.line - b.line)
}
