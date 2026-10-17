import { bodyLines } from '@/markdown/scan'
import { TABLE_ROW } from '@/markdown/structure'

/** The H2 sections a reference page may hold below its opening. */
export const REFERENCE_SECTIONS: readonly string[] = [
  'Output',
  'Refusals',
  'See also',
]

export type ReferenceShapeKind = 'extra-section' | 'subsection' | 'flag-table'

export interface ReferenceShapeFinding {
  readonly kind: ReferenceShapeKind
  readonly line: number
  /** The heading text, or the first header cell of a flag table. */
  readonly text: string
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?/
const MARKER = /^kind:\s*(["']?)reference\1\s*$/m
const HEADING = /^(#{2,3})\s+(.*?)(?:\s+#+)?\s*$/
const SEPARATOR_ROW = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/

/**
 * A first header cell naming flags or options, read with its code span and
 * emphasis stripped. Only the first column is read, so a refusal table headed
 * `Reason` stays out of reach whatever its later columns say.
 */
const FLAG_HEADER = /^(?:flags?|options?)$/i

/** Whether the page's frontmatter opts it into the reference shape. */
export function isReferencePage(source: string): boolean {
  const frontmatter = FRONTMATTER.exec(source)
  return frontmatter !== null && MARKER.test(frontmatter[1])
}

/**
 * Every breach of the reference shape on a page marked `kind: reference`, in
 * line order, and nothing on an unmarked page.
 *
 * The shape is an opening holding the command, then `## Output`,
 * `## Refusals`, and `## See also`, with no H3 and no table of flags, since
 * `--help` already prints them. The check reads headings and table headers
 * outside fences and leaves the opening to a reader.
 */
export function referenceShapeFindings(
  source: string,
): ReferenceShapeFinding[] {
  if (!isReferencePage(source)) return []

  const found: ReferenceShapeFinding[] = []
  const lines = bodyLines(source)

  for (const [index, line] of lines.entries()) {
    if (line.fenced) continue

    const heading = HEADING.exec(line.text)
    if (heading) {
      const [, marks, text] = heading
      if (marks.length === 3) {
        found.push({ kind: 'subsection', line: line.number, text })
      } else if (!REFERENCE_SECTIONS.includes(text)) {
        found.push({ kind: 'extra-section', line: line.number, text })
      }
      continue
    }

    const previous = lines[index - 1]
    const next = lines[index + 1]
    const opensTable =
      TABLE_ROW.test(line.text) &&
      !(previous && !previous.fenced && TABLE_ROW.test(previous.text)) &&
      next !== undefined &&
      SEPARATOR_ROW.test(next.text)
    if (!opensTable) continue

    const first = firstCell(line.text)
    if (FLAG_HEADER.test(first)) {
      found.push({ kind: 'flag-table', line: line.number, text: first })
    }
  }

  return found
}

function firstCell(row: string): string {
  const cells = row.trim().replace(/^\|/, '').split('|')
  return (cells[0] ?? '').replace(/[`*_]/g, '').trim()
}
