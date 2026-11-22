export interface BoardRow {
  readonly name: string
  readonly lane: number
  readonly line: string
  readonly waiting?: boolean
}

export interface BoardMove extends BoardRow {
  readonly at: string
}

/**
 * The board after the first `count` moves, each lane in the order its rows
 * arrived. A move into another lane lands the row last in it, and a move in
 * place keeps the row where it sits.
 */
export function boardAfter(
  rows: readonly BoardRow[],
  moves: readonly BoardMove[],
  count: number,
): BoardRow[] {
  let board = [...rows]
  for (const move of moves.slice(0, count)) {
    const at = board.findIndex((row) => row.name === move.name)
    const row: BoardRow = {
      name: move.name,
      lane: move.lane,
      line: move.line,
      waiting: move.waiting,
    }
    if (at >= 0 && board[at]?.lane === move.lane) {
      board[at] = row
      continue
    }
    board = [...board.filter((other) => other.name !== move.name), row]
  }
  return board
}

/**
 * Whether move `index` carries its row into another lane, which draws a slot
 * and a travel, rather than changing the row's line where it sits.
 */
export function travels(
  rows: readonly BoardRow[],
  moves: readonly BoardMove[],
  index: number,
): boolean {
  const move = moves[index]
  if (!move) return false
  const row = boardAfter(rows, moves, index).find(
    (other) => other.name === move.name,
  )
  return row?.lane !== move.lane
}
