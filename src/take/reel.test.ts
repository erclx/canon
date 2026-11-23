import { describe, expect, it } from 'vitest'
import {
  FPS,
  LOG_VERSION,
  START,
  type TakeLog,
  VIEWPORT,
  travelMs,
} from '@/take/log'
import {
  readReelWidth,
  REEL_DEPTH,
  reelCamera,
  reelDepth,
  reelShapeMismatch,
} from '@/take/reel'

/**
 * Covers which beats a reel can join, decided from each beat's window before
 * any frame decodes. The join itself is filmed in `reel.e2e.test.ts`.
 */

function beat(name: string, width: number, height: number) {
  return { name, viewport: { width, height } }
}

describe('reelShapeMismatch', () => {
  it('should find nothing in a reel with no beats', () => {
    expect(reelShapeMismatch([])).toBeUndefined()
  })

  it('should join beats of one aspect ratio at two sizes', () => {
    expect(
      reelShapeMismatch([beat('wide', 1920, 1080), beat('small', 960, 540)]),
    ).toBeUndefined()
  })

  it('should name the first beat whose aspect ratio differs, with both sizes', () => {
    expect(
      reelShapeMismatch([
        beat('wide', 1920, 1080),
        beat('small', 960, 540),
        beat('square', 800, 600),
        beat('tall', 320, 480),
      ]),
    ).toBe(
      "square films a 800x600 window, not the shape of wide's 1920x1080, so a reel cannot join them",
    )
  })
})

describe('readReelWidth', () => {
  const wide = { width: 1280, height: 720 }
  const small = { width: 800, height: 450 }

  it('should read an even width inside the floor and the narrowest window', () => {
    expect(readReelWidth('800', [wide, small])).toEqual({
      kind: 'read',
      width: 800,
    })
  })

  it('should read the floor itself', () => {
    expect(readReelWidth('320', [wide])).toEqual({ kind: 'read', width: 320 })
  })

  it('should refuse an odd width', () => {
    expect(readReelWidth('1181', [wide])).toMatchObject({ kind: 'refused' })
  })

  it('should refuse a width under the floor', () => {
    expect(readReelWidth('318', [wide])).toMatchObject({ kind: 'refused' })
  })

  it('should refuse a width past the narrowest window, not the first', () => {
    expect(readReelWidth('802', [wide, small])).toMatchObject({
      kind: 'refused',
    })
  })

  it('should refuse text that is not a whole number', () => {
    for (const text of ['wide', '960.5', '-960', '', '9e2']) {
      expect(readReelWidth(text, [wide])).toMatchObject({ kind: 'refused' })
    }
  })
})

describe('reelDepth', () => {
  it('should keep the default depth at the default width', () => {
    expect(reelDepth(1920, 960)).toBe(REEL_DEPTH)
  })

  it('should keep the default depth for a window narrower than the default width', () => {
    expect(reelDepth(800, 960)).toBe(REEL_DEPTH)
  })

  it('should keep the default depth under the default width', () => {
    expect(reelDepth(1920, 640)).toBe(REEL_DEPTH)
  })

  it('should lower the depth so a wider reel never upscales the decode', () => {
    expect(reelDepth(1920, 1280)).toBeCloseTo(1.5, 10)
    expect(reelDepth(1920, 1920)).toBe(1)
  })
})

describe('reelCamera', () => {
  /** One small click at the window center on a screencast, which films at its window. */
  function clickTake(): TakeLog {
    const at = { x: VIEWPORT.width / 2 + 200, y: VIEWPORT.height / 2 }
    const ms = travelMs(START, at)
    const t = ms + 1000
    return {
      version: LOG_VERSION,
      viewport: VIEWPORT,
      fps: FPS,
      route: 'screencast',
      frames: 6 * FPS,
      events: [
        { t: t - ms, kind: 'move', from: START, to: at, ms },
        {
          t,
          kind: 'click',
          at,
          box: { x: at.x - 12, y: at.y - 12, width: 24, height: 24 },
        },
      ],
    }
  }

  const deepest = (width: number) =>
    Math.max(...reelCamera(clickTake(), width).frames.map((f) => f.scale))

  it('should hold a zoom at the default depth in a default-width reel', () => {
    expect(deepest(960)).toBeCloseTo(REEL_DEPTH, 5)
  })

  it('should zoom no deeper than whole source pixels allow in a wider reel', () => {
    const limit = VIEWPORT.width / 1280

    expect(deepest(1280)).toBeLessThanOrEqual(limit + 1e-9)
    expect(deepest(1280)).toBeGreaterThan(limit - 0.05)
  })
})
