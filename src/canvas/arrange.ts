import { type Box, FRAME_GAP, type Frame } from '@/canvas/content'

export interface Placement {
  readonly name: string
  readonly from: Box
  readonly to: Box
}

function boxOf(frame: Frame): Box {
  return {
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
  }
}

/**
 * Boxes whose vertical spans overlap share a row, so a row the operator dragged
 * stays a row. Reading by overlap rather than by an equal `y` lets a frame a
 * few pixels off its neighbor still join it.
 */
function rowsOf(frames: readonly Frame[]): Frame[][] {
  const sorted = [...frames].sort((a, b) => a.y - b.y || a.x - b.x)
  const rows: Frame[][] = []
  let bottom = Number.NEGATIVE_INFINITY
  for (const frame of sorted) {
    const row = rows.at(-1)
    if (row && frame.y < bottom) {
      row.push(frame)
      bottom = Math.max(bottom, frame.y + frame.height)
    } else {
      rows.push([frame])
      bottom = frame.y + frame.height
    }
  }
  return rows.map((row) =>
    row.sort((a, b) => a.x - b.x || a.name.localeCompare(b.name)),
  )
}

/**
 * Re-lays a page's frames: each row left to right on `FRAME_GAP` from the
 * page's leftmost edge, rows stacked on their tallest box plus the gap from
 * the page's top edge. Returns only the frames whose position changes.
 */
export function planArrange(frames: readonly Frame[]): Placement[] {
  if (frames.length === 0) return []
  const left = Math.min(...frames.map((frame) => frame.x))
  let top = Math.min(...frames.map((frame) => frame.y))

  const moves: Placement[] = []
  for (const row of rowsOf(frames)) {
    let x = left
    for (const frame of row) {
      const from = boxOf(frame)
      const to: Box = { ...from, x, y: top }
      if (from.x !== to.x || from.y !== to.y) {
        moves.push({ name: frame.name, from, to })
      }
      x += frame.width + FRAME_GAP
    }
    top += Math.max(...row.map((frame) => frame.height)) + FRAME_GAP
  }
  return moves
}
