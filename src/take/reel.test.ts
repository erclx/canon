import { describe, expect, it } from 'vitest'
import { reelShapeMismatch } from '@/take/reel'

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
