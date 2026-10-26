import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { isWithinTolerance } from '@/pr/pixels'

const WHITE = [255, 255, 255] as const
const BLACK = [0, 0, 0] as const

type Rgb = readonly [number, number, number]

/** A PNG of `width` by `height`, white except where `paint` names a color for a pixel. */
function png(
  width: number,
  height: number,
  paint: (x: number, y: number) => Rgb = () => WHITE,
): Uint8Array {
  const image = new PNG({ width, height })
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y)
      const offset = (y * width + x) * 4
      image.data[offset] = r
      image.data[offset + 1] = g
      image.data[offset + 2] = b
      image.data[offset + 3] = 255
    }
  }
  return PNG.sync.write(image)
}

describe('isWithinTolerance', () => {
  it('should fold two identical images', () => {
    expect(isWithinTolerance(png(64, 64), png(64, 64))).toBe(true)
  })

  it('should fold single pixels scattered further apart than the window', () => {
    // 16 changed pixels in all, 20 apart, so no 16 by 16 window holds two.
    const scattered = png(64, 64, (x, y) =>
      x % 20 === 2 && y % 20 === 2 ? BLACK : WHITE,
    )

    expect(isWithinTolerance(png(64, 64), scattered)).toBe(true)
  })

  it('should leave a compact 1px border open', () => {
    const border = png(64, 64, (x, y) => {
      const inBox = x >= 20 && x <= 29 && y >= 20 && y <= 29
      const onEdge = x === 20 || x === 29 || y === 20 || y === 29
      return inBox && onEdge ? BLACK : WHITE
    })

    expect(isWithinTolerance(png(64, 64), border)).toBe(false)
  })

  it('should leave a uniform color shift open', () => {
    const shifted = png(64, 64, () => [180, 180, 180])

    expect(isWithinTolerance(png(64, 64), shifted)).toBe(false)
  })

  it('should leave a size change open', () => {
    expect(isWithinTolerance(png(64, 64), png(64, 65))).toBe(false)
  })

  it('should leave an undecodable image open', () => {
    const garbage = new Uint8Array([1, 2, 3, 4])

    expect(isWithinTolerance(png(64, 64), garbage)).toBe(false)
  })
})
