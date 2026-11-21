import { readFileSync } from 'node:fs'

/**
 * One table cell, split into the value a renderer emits and whether the record
 * marked it as unsourced. The marker sits inside the cell, since a trailing
 * column breaks the table parse, and splitting it out keeps swatches built from the value.
 */
export interface Cell {
  value: string
  tagged: boolean
}

export type Row = Record<string, Cell>

export interface DesignDoc {
  personality: string
  color: Row[]
  typography: Row[]
  spacing: Row[]
  borders: Row[]
  motion: string
  iconography: string
}

/**
 * The three headings the standard renamed, each read as the section it became.
 * Records written before the rename sit in targets and will not rename
 * themselves, and `DesignDoc` keeps the old field names.
 */
export const LEGACY_HEADINGS: Readonly<Record<string, string>> = {
  Personality: 'Overview',
  Color: 'Colors',
  Borders: 'Shapes',
}

export function canonicalHeading(heading: string): string {
  return LEGACY_HEADINGS[heading] ?? heading
}

const VERIFY_TAG = /\s*\?\s*verify\s*$/

/** A cell whose whole content is one balanced code span and nothing else. */
const CODE_SPAN = /^`([^`]*)`$/

export function parseDesignDoc(path: string): DesignDoc {
  const raw = readFileSync(path, 'utf8')
  const sections = splitSections(raw)
  return {
    personality: prose(sections['Overview']),
    color: table(sections['Colors']),
    typography: table(sections['Typography']),
    spacing: table(sections['Spacing']),
    borders: table(sections['Shapes']),
    motion: prose(sections['Motion']),
    iconography: prose(sections['Iconography']),
  }
}

/**
 * Every table under one section, in the order the record writes them, including
 * ones `parseDesignDoc` does not reach, such as the shadows under Shapes. A
 * missing section reads as no tables rather than an error.
 */
export function parseSectionTables(path: string, heading: string): Row[][] {
  const sections = splitSections(readFileSync(path, 'utf8'))
  const body = sections[canonicalHeading(heading)]
  if (!body) return []
  const piped = body.split('\n').filter((l) => l.trim().startsWith('|'))
  const starts = piped
    .map((l, i) => (i > 0 && DELIMITER.test(l) ? i - 1 : -1))
    .filter((i) => i !== -1)
  return starts.map((start, n) =>
    rowsOf(piped.slice(start, starts[n + 1] ?? piped.length)),
  )
}

function splitSections(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  const lines = raw.split('\n')
  let current: string | null = null
  let buffer: string[] = []
  for (const line of lines) {
    const match = line.match(/^##\s+(.+?)\s*$/)
    if (match) {
      if (current) out[current] = buffer.join('\n')
      current = canonicalHeading(match[1])
      buffer = []
    } else if (current) {
      buffer.push(line)
    }
  }
  if (current) out[current] = buffer.join('\n')
  return out
}

function prose(body: string | undefined): string {
  if (!body) return ''
  return body
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('|') && !l.startsWith('<'))
    .join('\n')
    .trim()
}

/** A table's delimiter row, which opens its body. */
const DELIMITER = /^\s*\|\s*:?-{3,}/

/**
 * The first table in a section, ending on the row heading the next delimiter,
 * since a section may carry a second with columns of its own. Rows are matched
 * by their pipe, since a hand-written record can leave blank lines between them.
 */
function table(body: string | undefined): Row[] {
  if (!body) return []
  const piped = body.split('\n').filter((l) => l.trim().startsWith('|'))
  const second = piped.findIndex((l, i) => i > 1 && DELIMITER.test(l))
  const rows = second === -1 ? piped : piped.slice(0, second - 1)
  return rowsOf(rows)
}

/** One table's piped lines, header and delimiter first, as keyed rows. */
function rowsOf(rows: readonly string[]): Row[] {
  if (rows.length < 2) return []
  const headers = splitRow(rows[0]).map((c) => c.value)
  const data = rows.slice(2)
  return data.map((line) => {
    const cells = splitRow(line)
    const row: Row = {}
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? emptyCell()
    })
    return row
  })
}

function emptyCell(): Cell {
  return { value: '', tagged: false }
}

function splitRow(line: string): Cell[] {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map(parseCell)
}

/**
 * The tag is tested against the cell with any surrounding code span removed,
 * since a value wrapped in backticks puts one after the tag. The span is
 * restored so tagged and untagged cells carry the same formatting.
 */
function parseCell(raw: string): Cell {
  const trimmed = raw.trim()
  const span = trimmed.match(CODE_SPAN)
  const inner = span ? span[1] : trimmed
  if (!VERIFY_TAG.test(inner)) return { value: trimmed, tagged: false }
  const value = inner.replace(VERIFY_TAG, '')
  return { value: span ? `\`${value}\`` : value, tagged: true }
}
