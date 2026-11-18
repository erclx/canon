import { describe, expect, it } from 'vitest'

import { boardAfter } from './state'

const rows = [
  { name: 'a', lane: 0, line: 'plan linked' },
  { name: 'b', lane: 0, line: 'plan linked' },
  { name: 'c', lane: 1, line: 'worker' },
]

describe('boardAfter', () => {
  it('should land a row moved into another lane last in it', () => {
    const board = boardAfter(
      rows,
      [{ at: '00:10', name: 'a', lane: 1, line: 'worker' }],
      1,
    )

    expect(board.map((row) => `${row.lane}:${row.name}`)).toEqual([
      '0:b',
      '1:c',
      '1:a',
    ])
  })

  it('should keep a row changed in place where it sits', () => {
    const board = boardAfter(
      rows,
      [{ at: '00:10', name: 'a', lane: 0, line: 'needs a plan' }],
      1,
    )

    expect(board[0]).toEqual({
      name: 'a',
      lane: 0,
      line: 'needs a plan',
      waiting: undefined,
    })
  })

  it('should apply only the first count moves', () => {
    const moves = [
      { at: '00:10', name: 'a', lane: 1, line: 'worker' },
      { at: '00:20', name: 'b', lane: 2, line: 'review closed' },
    ]

    const board = boardAfter(rows, moves, 1)

    expect(board.find((row) => row.name === 'b')?.lane).toBe(0)
  })

  it('should return the rows as they start at no moves', () => {
    expect(boardAfter(rows, [], 0)).toEqual(rows)
  })
})
