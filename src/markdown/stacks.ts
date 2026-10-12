import type { BodyLine } from '@/markdown/scan'

/**
 * The most plain bullets one run may carry. Past it a reader holds the list as
 * a whole rather than item by item, and the shape wants prose, an H3 per item,
 * or a split at the seam.
 */
export const CAP = 5

/** A top-level bullet marker followed by its content, at column zero only. */
const BULLET = /^[-*+][ \t]+(.*)$/

/**
 * An item opening with a bold label or a link names its own subject. A task
 * box (`[ ]`, `[x]`) opens with a bracket too and is not a link, so a checklist
 * counts as a plain run.
 */
const LABELED = /^(?:\*\*|__|\[(?![ xX]\]))/

export interface StackFinding {
  /** The line of the run's first item, as an editor numbers it. */
  readonly line: number
  readonly count: number
}

interface Run {
  readonly line: number
  count: number
  labeled: number
}

/**
 * Every run of top-level bullets past `CAP`, in document order.
 *
 * A run is consecutive column-zero `-`, `*`, or `+` items. A blank line, an
 * indented continuation, and a nested item do not break it, and any other
 * column-zero line does, since a paragraph or heading between two lists makes
 * them two. Fenced lines are skipped rather than breaking the run, so a code
 * block inside an item does not split it. A run whose every item opens with a
 * bold label or a link is exempt, because each item carries its own subject
 * and reads as a table of entries rather than a list to hold.
 *
 * Numbered items do not count: a numbered list states an order the reader
 * follows one step at a time.
 */
export function bulletStacks(lines: readonly BodyLine[]): StackFinding[] {
  const found: StackFinding[] = []
  let run: Run | undefined

  const close = (): void => {
    if (run && run.count > CAP && run.labeled < run.count) {
      found.push({ line: run.line, count: run.count })
    }
    run = undefined
  }

  for (const { number, text, fenced } of lines) {
    if (fenced) continue
    if (text.trim() === '' || /^\s/.test(text)) continue

    const match = BULLET.exec(text)
    if (!match) {
      close()
      continue
    }

    run ??= { line: number, count: 0, labeled: 0 }
    run.count++
    if (LABELED.test(match[1])) run.labeled++
  }

  close()
  return found
}
