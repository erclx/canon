import { describe, expect, it } from 'vitest'
import { type Frame, RING_RADIUS, drawPointer } from '@/take/pointer'

/**
 * Reads the pixels the pointer leaves on a plain frame, since the reel is
 * judged by eye and a drawn arrow or ring off its point is the failure a
 * reviewer would see first.
 */

const GREY = 128

function blank(width = 120, height = 120): Frame {
  const data = new Uint8Array(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = GREY
    data[i + 1] = GREY
    data[i + 2] = GREY
    data[i + 3] = 255
  }
  return { data, width, height }
}

function pixel(frame: Frame, x: number, y: number): number[] {
  const i = (y * frame.width + x) * 4
  return Array.from(frame.data.subarray(i, i + 4))
}

describe('drawPointer', () => {
  it('fills the arrow dark just inside its tip', () => {
    const frame = blank()
    drawPointer(frame, { x: 40, y: 40 }, null)

    // The arrow's shaft runs down from the tip, so a few pixels below and
    // right of it sit inside the fill.
    const [r, g, b] = pixel(frame, 42, 48)
    expect(r).toBeLessThan(40)
    expect(g).toBeLessThan(40)
    expect(b).toBeLessThan(40)
  })

  it('outlines the arrow in white', () => {
    const frame = blank()
    drawPointer(frame, { x: 40, y: 40 }, null)

    // The left edge of the shaft runs straight down from the tip.
    const brightest = Math.max(
      ...[38, 39, 40].map((x) => pixel(frame, x, 50)[0] ?? 0),
    )
    expect(brightest).toBeGreaterThan(200)
  })

  it('leaves the frame untouched away from the pointer', () => {
    const frame = blank()
    drawPointer(frame, { x: 40, y: 40 }, null)

    expect(pixel(frame, 10, 10)).toEqual([GREY, GREY, GREY, 255])
    expect(pixel(frame, 100, 100)).toEqual([GREY, GREY, GREY, 255])
    // Up and left of the tip, where a ring would be, nothing is drawn.
    expect(pixel(frame, 30, 30)).toEqual([GREY, GREY, GREY, 255])
  })

  it('draws the ring at its radius for the expansion', () => {
    const frame = blank()
    drawPointer(frame, { x: 60, y: 60 }, 0.6)

    // At 0.6 the ring is scaled to 1.0 of its size, its stroke centered just
    // inside the outer radius. Read it straight up from the point, where the
    // arrow does not reach.
    const radius = Math.round(RING_RADIUS - 1)
    const [r, , b] = pixel(frame, 60, 60 - radius)
    expect(b).toBeGreaterThan(r)
    expect(b).toBeGreaterThan(GREY)
    // Inside the ring and off the arrow, the frame shows through.
    expect(pixel(frame, 60, 60 - Math.round(radius / 2))).toEqual([
      GREY,
      GREY,
      GREY,
      255,
    ])
  })

  it('fades the ring as it expands', () => {
    const early = blank()
    const late = blank()
    drawPointer(early, { x: 60, y: 60 }, 0.6)
    drawPointer(late, { x: 60, y: 60 }, 0.95)

    // Read each at its own radius, straight up from the point.
    const at = (ring: number) => Math.round((RING_RADIUS - 1) * (0.4 + ring))
    const earlyBlue = (pixel(early, 60, 60 - at(0.6))[2] ?? 0) - GREY
    const lateBlue = (pixel(late, 60, 60 - at(0.95))[2] ?? 0) - GREY
    expect(earlyBlue).toBeGreaterThan(lateBlue)
  })

  it('draws no ring when ring is null', () => {
    const frame = blank()
    drawPointer(frame, { x: 60, y: 60 }, null)

    const radius = Math.round(RING_RADIUS - 1)
    expect(pixel(frame, 60, 60 - radius)).toEqual([GREY, GREY, GREY, 255])
  })

  it('clips a pointer at the frame edge rather than throwing', () => {
    const frame = blank(20, 20)
    expect(() => drawPointer(frame, { x: 18, y: 18 }, 0.2)).not.toThrow()
    expect(() => drawPointer(frame, { x: -50, y: -50 }, 0.2)).not.toThrow()
  })
})
