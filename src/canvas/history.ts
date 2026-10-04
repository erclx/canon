import type { Box } from '@/canvas/content'

/**
 * The operator's shell edits, held by one `canon canvas serve` process. Only
 * the server's write routes record here, so an edit made through a file or a
 * CLI verb never enters it. An entry carries the state it replaced and the
 * state it wrote, and applying it checks the second is still there.
 */

/** What an element entry restores: the raw style attribute, and raw inner content for a text edit. */
export interface ElementState {
  readonly style: string | undefined
  readonly inner?: string
}

export interface ElementEntry {
  readonly kind: 'element'
  readonly page: string
  readonly frame: string
  readonly index: number
  readonly tag: string
  readonly before: ElementState
  readonly after: ElementState
  /** Edits a control posts as one gesture share this, and merge into one entry. */
  readonly step?: string
}

export interface BoxEntry {
  readonly kind: 'box'
  readonly page: string
  readonly frame: string
  /** Undefined when the layout held no box, so the reader placed the frame. */
  readonly before: Box | undefined
  readonly after: Box
}

export type HistoryEntry = ElementEntry | BoxEntry

export type Direction = 'undo' | 'redo'

/**
 * `dropped` means the target changed since the entry was recorded, so the
 * entry is discarded unwritten. `busy` leaves it in place to try again.
 */
export type ApplyResult = 'applied' | 'dropped' | 'busy'

export type HistoryOutcome = ApplyResult | 'empty'

export interface HistoryFlags {
  readonly canUndo: boolean
  readonly canRedo: boolean
}

export const HISTORY_CAP = 100

function isSameTarget(a: ElementEntry, b: ElementEntry): boolean {
  return (
    a.page === b.page &&
    a.frame === b.frame &&
    a.index === b.index &&
    a.tag === b.tag
  )
}

export class History {
  private readonly undone: HistoryEntry[] = []
  private readonly done: HistoryEntry[] = []

  constructor(private readonly cap = HISTORY_CAP) {}

  record(entry: HistoryEntry): void {
    this.undone.length = 0
    const last = this.done.at(-1)
    if (
      entry.kind === 'element' &&
      entry.step !== undefined &&
      last?.kind === 'element' &&
      last.step === entry.step &&
      isSameTarget(last, entry)
    ) {
      this.done[this.done.length - 1] = { ...last, after: entry.after }
      return
    }
    this.done.push(entry)
    if (this.done.length > this.cap) this.done.shift()
  }

  undo(apply: (entry: HistoryEntry, direction: Direction) => ApplyResult) {
    return this.move(this.done, this.undone, 'undo', apply)
  }

  redo(apply: (entry: HistoryEntry, direction: Direction) => ApplyResult) {
    return this.move(this.undone, this.done, 'redo', apply)
  }

  flags(): HistoryFlags {
    return { canUndo: this.done.length > 0, canRedo: this.undone.length > 0 }
  }

  private move(
    from: HistoryEntry[],
    to: HistoryEntry[],
    direction: Direction,
    apply: (entry: HistoryEntry, direction: Direction) => ApplyResult,
  ): HistoryOutcome {
    const entry = from.at(-1)
    if (!entry) return 'empty'
    const result = apply(entry, direction)
    if (result === 'busy') return result
    from.pop()
    if (result === 'applied') to.push(entry)
    return result
  }
}
