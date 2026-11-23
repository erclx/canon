import { describe, expect, it } from 'vitest'
import { readReelWidth, reelShapeMismatch } from '@/take/reel'

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
