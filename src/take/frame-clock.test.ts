import { describe, expect, it } from 'vitest'
import { frameStamp, slotFrames } from '@/take/frame-clock'

const WALL_START = 1_000_000

describe('frameStamp', () => {
  it('should place a frame by how long ago it was presented', () => {
    expect(
      frameStamp({
        presentedWall: WALL_START + 480,
        wallNow: WALL_START + 500,
        monoNow: 500,
      }),
    ).toBe(480)
  })

  it('should not move a frame when the wall clock stepped forward before it', () => {
    const step = 3562

    expect(
      frameStamp({
        presentedWall: WALL_START + 480 + step,
        wallNow: WALL_START + 500 + step,
        monoNow: 500,
      }),
    ).toBe(480)
  })

  it('should not move a frame when the wall clock stepped backward before it', () => {
    const step = -3562

    expect(
      frameStamp({
        presentedWall: WALL_START + 480 + step,
        wallNow: WALL_START + 500 + step,
        monoNow: 500,
      }),
    ).toBe(480)
  })

  it('should land a frame early when a forward step falls between its swap and arrival', () => {
    expect(
      frameStamp({
        presentedWall: WALL_START + 480,
        wallNow: WALL_START + 500 + 3562,
        monoNow: 500,
      }),
    ).toBe(-3082)
  })

  it('should never lift a stamp past the arrival when a backward step falls between them', () => {
    expect(
      frameStamp({
        presentedWall: WALL_START + 480,
        wallNow: WALL_START + 500 - 3562,
        monoNow: 500,
      }),
    ).toBe(500)
  })
})

describe('slotFrames', () => {
  const clip = { startMs: 1000, lengthMs: 50, frameMs: 10 }

  it('should have no slots to fill when no frame arrived', () => {
    expect(slotFrames([], clip)).toEqual([])
  })

  it('should fill one slot per frame interval of the filmed length', () => {
    expect(slotFrames([1000], clip)).toHaveLength(5)
  })

  it('should hold the last frame through a gap with no frames', () => {
    expect(slotFrames([1000, 1010], clip)).toEqual([0, 1, 1, 1, 1])
  })

  it('should hold one frame of a still page for the whole length', () => {
    expect(slotFrames([1000], clip)).toEqual([0, 0, 0, 0, 0])
  })

  it('should give slot 0 the newest frame presented before the start', () => {
    expect(slotFrames([970, 990, 1020], clip)).toEqual([1, 1, 2, 2, 2])
  })

  it('should give slot 0 the first frame when it was presented after the start', () => {
    expect(slotFrames([1025], clip)).toEqual([0, 0, 0, 0, 0])
  })

  it('should leave a frame stamped past the length off the clip', () => {
    expect(slotFrames([1000, 1045], clip)).toEqual([0, 0, 0, 0, 0])
  })

  it('should keep arrival order when a frame is stamped ahead of the one before it', () => {
    expect(slotFrames([1000, 1030, 1005, 1040], clip)).toEqual([0, 0, 0, 2, 3])
  })
})
