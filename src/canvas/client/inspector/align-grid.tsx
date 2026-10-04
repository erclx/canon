/** @jsxImportSource preact */
import type { JSX } from 'preact'
import { useRef, useState } from 'preact/hooks'

/** The value each third of an axis writes, start to end as the axis runs. */
const POSITIONS = ['flex-start', 'center', 'flex-end'] as const

const ROWS = ['top', 'middle', 'bottom'] as const
const COLUMNS = ['left', 'center', 'right'] as const

/**
 * Computed values that read as one of the three positions. A container left
 * at its defaults packs from the start, and stretched children do too, so
 * both show the start cell without stating it.
 */
const READS: Readonly<Record<string, number>> = {
  normal: 0,
  stretch: 0,
  'flex-start': 0,
  start: 0,
  'self-start': 0,
  left: 0,
  center: 1,
  'flex-end': 2,
  end: 2,
  'self-end': 2,
  right: 2,
}

/** Values a container takes without stating a position, which a pick pins. */
const IMPLIED = new Set(['normal', 'stretch'])

export interface Alignment {
  readonly justifyContent: string
  readonly alignItems: string
}

interface AlignGridProps {
  /** The container's computed `flex-direction`, which decides the axes. */
  readonly direction: string
  readonly justifyContent: string
  readonly alignItems: string
  readonly isBusy: boolean
  readonly onPick: (alignment: Alignment) => void
}

function isRow(direction: string): boolean {
  return !direction.startsWith('column')
}

/**
 * The cell, as row then column on screen, that a container's alignment puts
 * its children in. A reversed main axis runs from the far edge, so its start
 * is the right or the bottom.
 */
function cellOf(
  direction: string,
  justifyContent: string,
  alignItems: string,
): readonly [number, number] | undefined {
  const main = READS[justifyContent.trim()]
  const cross = READS[alignItems.trim()]
  if (main === undefined || cross === undefined) return undefined
  const along = direction.endsWith('reverse') ? 2 - main : main
  return isRow(direction) ? [cross, along] : [along, cross]
}

function alignmentOf(
  direction: string,
  row: number,
  column: number,
): Alignment {
  const [main, cross] = isRow(direction) ? [column, row] : [row, column]
  const along = direction.endsWith('reverse') ? 2 - main : main
  return {
    justifyContent: POSITIONS[along],
    alignItems: POSITIONS[cross],
  }
}

const KEY_STEPS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
}

/**
 * Nine cells placing a flex container's children, one radio group. The
 * arrow keys move focus inside the grid and stop at its edges, and a press
 * or Enter or Space picks, since each pick writes the frame twice.
 */
export function AlignGrid({
  direction,
  justifyContent,
  alignItems,
  isBusy,
  onPick,
}: AlignGridProps): JSX.Element {
  const checked = cellOf(direction, justifyContent, alignItems)
  const isImplied =
    IMPLIED.has(justifyContent.trim()) || IMPLIED.has(alignItems.trim())
  const [focus, setFocus] = useState<readonly [number, number]>(
    checked ?? [0, 0],
  )
  const cells = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (event: KeyboardEvent) => {
    const step = KEY_STEPS[event.key]
    if (!step) return
    event.preventDefault()
    const next = [
      Math.min(2, Math.max(0, focus[0] + step[0])),
      Math.min(2, Math.max(0, focus[1] + step[1])),
    ] as const
    setFocus(next)
    cells.current[next[0] * 3 + next[1]]?.focus()
  }

  return (
    <div
      class="align-grid"
      role="radiogroup"
      aria-label="Alignment"
      onKeyDown={handleKeyDown}
    >
      {ROWS.map((rowName, row) =>
        COLUMNS.map((columnName, column) => {
          const isChecked = checked?.[0] === row && checked[1] === column
          const isFocusable = focus[0] === row && focus[1] === column
          const name =
            rowName === 'middle' && columnName === 'center'
              ? 'center'
              : `${rowName} ${columnName}`
          return (
            <button
              key={name}
              ref={(node) => {
                cells.current[row * 3 + column] = node
              }}
              type="button"
              class="align-cell"
              role="radio"
              aria-label={name}
              aria-checked={isChecked}
              tabIndex={isFocusable ? 0 : -1}
              disabled={isBusy}
              onFocus={() => setFocus([row, column])}
              onClick={() => {
                if (!isChecked || isImplied) {
                  onPick(alignmentOf(direction, row, column))
                }
              }}
            >
              <span class="align-dot" aria-hidden="true" />
            </button>
          )
        }),
      )}
    </div>
  )
}
