import { describe, expect, it } from 'vitest'
import { planArrange } from '@/canvas/arrange'
import { FRAME_GAP, type Frame } from '@/canvas/content'

function frame(
  name: string,
  x: number,
  y: number,
  width = 100,
  height = 50,
): Frame {
  return { name, file: `${name}.html`, x, y, width, height, placed: true }
}

function targets(frames: readonly Frame[]) {
  return Object.fromEntries(
    planArrange(frames).map((move) => [move.name, move.to]),
  )
}

describe('planArrange', () => {
  it('should place a row left to right on the frame gap', () => {
    const moved = targets([frame('a', 0, 0), frame('b', 300, 0, 200)])

    expect(moved).toEqual({
      b: { x: 100 + FRAME_GAP, y: 0, width: 200, height: 50 },
    })
  })

  it('should stack a second row under the tallest box of the first', () => {
    const moved = targets([
      frame('a', 0, 0, 100, 40),
      frame('b', 200, 0, 100, 120),
      frame('c', 0, 500),
    ])

    expect(moved).toEqual({
      b: { x: 100 + FRAME_GAP, y: 0, width: 100, height: 120 },
      c: { x: 0, y: 120 + FRAME_GAP, width: 100, height: 50 },
    })
  })

  it('should keep two rows the operator dragged rather than flattening them', () => {
    const moved = targets([
      frame('a', 0, 0),
      frame('b', 180, 0),
      frame('c', 0, 400),
      frame('d', 180, 400),
    ])

    expect(Object.keys(moved).sort()).toEqual(['c', 'd'])
    expect(moved.c?.y).toBe(50 + FRAME_GAP)
    expect(moved.d?.y).toBe(50 + FRAME_GAP)
    expect(moved.d?.x).toBe(100 + FRAME_GAP)
  })

  it('should order a row by x whatever the frame names', () => {
    const moved = targets([frame('z', 0, 0), frame('a', 150, 0)])

    expect(moved.a?.x).toBe(100 + FRAME_GAP)
  })

  it('should report nothing when the page is already laid out', () => {
    expect(
      planArrange([frame('a', 0, 0), frame('b', 100 + FRAME_GAP, 0)]),
    ).toEqual([])
  })

  it('should treat boxes that overlap vertically as one row', () => {
    const moved = targets([frame('a', 0, 0, 100, 100), frame('b', 500, 60)])

    expect(moved.b).toEqual({
      x: 100 + FRAME_GAP,
      y: 0,
      width: 100,
      height: 50,
    })
  })

  it('should be empty for a page with no frames', () => {
    expect(planArrange([])).toEqual([])
  })
})
