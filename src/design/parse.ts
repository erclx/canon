import { readFileSync } from 'node:fs'

/**
 * One table cell, split into the value a renderer emits and whether the record
 * marked it as unsourced.
 *
 * The marker sits inside the cell rather than in a trailing column, because a
 * trailing marker breaks the table parse. Splitting it out here is what keeps a
 * swatch or a font sample built from the value alone.
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
 * The three headings the standard renamed toward Google's DESIGN.md, each read
 * as the section it became. Records the seed and `canvas-board` wrote before
 * the rename sit in targets and will not rename themselves, and an unmatched
 * heading parses to nothing without saying so. The field names on `DesignDoc`
 * keep the old words, since the preview reading them is retired separately.
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

function table(body: string | undefined): Row[] {
  if (!body) return []
  const rows = body.split('\n').filter((l) => l.trim().startsWith('|'))
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
 * since a value wrapping itself in backticks puts one after the tag and an
 * end-anchored test misses it there. The span is restored around the clean
 * value so an untagged cell and a tagged one carry the same formatting.
 */
function parseCell(raw: string): Cell {
  const trimmed = raw.trim()
  const span = trimmed.match(CODE_SPAN)
  const inner = span ? span[1] : trimmed
  if (!VERIFY_TAG.test(inner)) return { value: trimmed, tagged: false }
  const value = inner.replace(VERIFY_TAG, '')
  return { value: span ? `\`${value}\`` : value, tagged: true }
}
