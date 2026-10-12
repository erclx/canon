import { bodyLines } from '@/markdown/scan'
import {
  CHECKPOINTS,
  type Checkpoints,
  type LongBlock,
  longBlocks,
} from '@/markdown/structure'

/**
 * Reduces text to the words a reader meets, so a block reflowed, re-marked, or
 * moved under another heading still matches the copy it came from.
 *
 * List markers and emphasis marks are dropped because turning a bullet into a
 * labelled bullet or a paragraph changes the shape of a statement and none of
 * its words, which is the edit the sweep makes. A word changed is a text
 * changed, and that is what the growth stage exists to see.
 */
export function normalizeProse(text: string): string {
  return text
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The paragraphs and top-level bullets of `source` past their checkpoints whose
 * text appears nowhere in `base`.
 *
 * Containment rather than line matching, so an unchanged long block passes
 * wherever it sits and an edited or new one fails. `base` is every document the
 * caller counts as the copy it may have come from, already normalized, since a
 * block moved into a sibling entry is as unchanged as one left in place.
 */
export function grownBlocks(
  source: string,
  base: string,
  checkpoints: Checkpoints = CHECKPOINTS,
): LongBlock[] {
  return longBlocks(bodyLines(source), checkpoints).filter(
    (block) => !base.includes(normalizeProse(block.text)),
  )
}
