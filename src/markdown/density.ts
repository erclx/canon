import { type BodyLine, visibleText } from '@/markdown/scan'
import { bulletStacks, CAP } from '@/markdown/stacks'
import {
  BLOCKQUOTE,
  CHECKPOINTS,
  HEADING,
  isSectionMarker,
  LIST_ITEM,
  TABLE_ROW,
} from '@/markdown/structure'

/** The most prose paragraphs one stretch may carry before a list, table, or heading breaks it. */
export const PARAGRAPH_RUN = 2

/** The deepest heading level a document may use. */
export const HEADING_DEPTH = 3

export type DensityKind =
  | 'paragraph-length'
  | 'paragraph-run'
  | 'bullet-length'
  | 'bullet-run'
  | 'heading-depth'
  | 'h3-opening'
  | 'table-cell'
  | 'table-then-list'

export interface DensityFinding {
  readonly kind: DensityKind
  /** The line of the block that breaches, or of a run's first block. */
  readonly line: number
  /** What was measured, or null for the H3 opening, which is a shape rather than a count. */
  readonly value: number | null
  readonly limit: number | null
}

/**
 * A block as a reader meets it. `other` is everything that is neither prose,
 * a list item, nor a heading, being a table, a fence, a blockquote, a section
 * marker, and raw HTML, and each one breaks a paragraph run.
 */
type Block =
  | { readonly kind: 'heading'; readonly line: number; readonly level: number }
  | { readonly kind: 'paragraph'; readonly line: number; readonly text: string }
  | { readonly kind: 'item'; readonly line: number; readonly text: string }
  | { readonly kind: 'other'; readonly line: number; readonly table: boolean }

/**
 * Splits the body into the blocks the six limits read.
 *
 * Its own walk rather than `paragraphBlocks` in `src/markdown/structure.ts`,
 * because the two disagree on one construct and the disagreement is the point.
 * That walk reads an indented paragraph under a list item as a paragraph, and
 * here it belongs to the item: it counts toward the bullet's length and never
 * toward a paragraph run, since a reader sees it inside the list.
 *
 * A nested item is left out of its parent, as `heavyBullets` leaves it, and so
 * is everything indented under the nested item. An indented fence inside an
 * item stays with the item, and a column-zero one ends it.
 */
function blocksOf(lines: readonly BodyLine[]): Block[] {
  const blocks: Block[] = []
  let paragraph: { line: number; parts: string[] } | undefined
  let item: { line: number; parts: string[]; nested: boolean } | undefined
  let inFence = false
  let afterBlank = false

  const closeParagraph = (): void => {
    if (paragraph) {
      blocks.push({
        kind: 'paragraph',
        line: paragraph.line,
        text: paragraph.parts.join(' '),
      })
    }
    paragraph = undefined
  }

  const closeItem = (): void => {
    if (item) {
      blocks.push({ kind: 'item', line: item.line, text: item.parts.join(' ') })
    }
    item = undefined
  }

  const closeAll = (): void => {
    closeParagraph()
    closeItem()
  }

  for (const line of lines) {
    const raw = line.text
    const text = raw.trim()
    const indented = /^\s/.test(raw)

    if (line.fenced) {
      // The opening delimiter decides who owns the block. `bodyLines` marks a
      // delimiter and the body alike, so the opener is the first fenced line.
      if (!inFence) {
        if (!(item && indented)) {
          closeAll()
          blocks.push({ kind: 'other', line: line.number, table: false })
        }
      }
      inFence = true
      afterBlank = false
      continue
    }
    inFence = false

    if (text === '') {
      closeParagraph()
      afterBlank = true
      continue
    }

    if (indented && item) {
      if (LIST_ITEM.test(raw)) item.nested = true
      else if (!item.nested && !TABLE_ROW.test(raw)) item.parts.push(text)
      afterBlank = false
      continue
    }

    if (HEADING.test(raw)) {
      closeAll()
      blocks.push({
        kind: 'heading',
        line: line.number,
        level: (raw.match(/^#+/)?.[0] ?? '').length,
      })
    } else if (!indented && LIST_ITEM.test(raw)) {
      closeAll()
      item = {
        line: line.number,
        parts: [text.replace(LIST_ITEM, '')],
        nested: false,
      }
    } else if (
      TABLE_ROW.test(raw) ||
      BLOCKQUOTE.test(raw) ||
      isSectionMarker(raw) ||
      text.startsWith('<')
    ) {
      closeAll()
      blocks.push({
        kind: 'other',
        line: line.number,
        table: TABLE_ROW.test(raw),
      })
    } else if (paragraph) {
      paragraph.parts.push(text)
    } else if (item && !afterBlank) {
      // A lazy continuation, which renders inside the item above it.
      item.parts.push(text)
    } else {
      closeItem()
      paragraph = { line: line.number, parts: [text] }
    }

    afterBlank = false
  }

  closeAll()

  return blocks
}

/**
 * Every breach of the six density limits, in line order.
 *
 * Each limit is a count rather than a judgment, so a finding is a fact a scan
 * settles and the caller decides whether it gates. The limits are a 350-character
 * paragraph, 2 paragraphs in a row, a 200-character bullet, 5 plain bullets in
 * a row, no heading past H3, and a paragraph or a table as the first block
 * under every H3. The two length numbers are `CHECKPOINTS`, so the advisory
 * Bullets and Paragraphs sections and this measure read one number, and the
 * bullet run is `bulletStacks`, so a bold-labeled run stays exempt here too.
 */
export function densityFindings(lines: readonly BodyLine[]): DensityFinding[] {
  const found: DensityFinding[] = []
  const blocks = blocksOf(lines)
  let run: { line: number; count: number } | undefined

  const closeRun = (): void => {
    if (run && run.count > PARAGRAPH_RUN) {
      found.push({
        kind: 'paragraph-run',
        line: run.line,
        value: run.count,
        limit: PARAGRAPH_RUN,
      })
    }
    run = undefined
  }

  for (const [index, block] of blocks.entries()) {
    if (block.kind !== 'paragraph') closeRun()

    if (block.kind === 'paragraph') {
      run ??= { line: block.line, count: 0 }
      run.count++
      const length = visibleText(block.text).length
      if (length > CHECKPOINTS.paragraph) {
        found.push({
          kind: 'paragraph-length',
          line: block.line,
          value: length,
          limit: CHECKPOINTS.paragraph,
        })
      }
    } else if (block.kind === 'item') {
      const length = visibleText(block.text).length
      if (length > CHECKPOINTS.bullet) {
        found.push({
          kind: 'bullet-length',
          line: block.line,
          value: length,
          limit: CHECKPOINTS.bullet,
        })
      }
    } else if (block.kind === 'heading') {
      if (block.level > HEADING_DEPTH) {
        found.push({
          kind: 'heading-depth',
          line: block.line,
          value: block.level,
          limit: HEADING_DEPTH,
        })
      }
      if (block.level === 3 && !opensWithLead(blocks[index + 1])) {
        found.push({
          kind: 'h3-opening',
          line: block.line,
          value: null,
          limit: null,
        })
      }
    }
  }

  closeRun()

  for (const stack of bulletStacks(lines)) {
    found.push({
      kind: 'bullet-run',
      line: stack.line,
      value: stack.count,
      limit: CAP,
    })
  }

  return found.sort((a, b) => a.line - b.line)
}

/** Whether the block under an H3 is the paragraph or table the limit asks for. */
function opensWithLead(next: Block | undefined): boolean {
  if (next === undefined) return false
  if (next.kind === 'paragraph') return true
  return next.kind === 'other' && next.table
}
