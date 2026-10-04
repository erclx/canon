import { describe, expect, it } from 'vitest'
import {
  hexToRgb,
  hslToRgb,
  hsvToRgb,
  lchToRgb,
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  rgbToLch,
} from '@/canvas/client/inspector/color-space'

function rgb(r: number, g: number, b: number) {
  return { r, g, b }
}

function rounded(color: object): Record<string, number> {
  return Object.fromEntries(
    Object.entries(color).map(([key, value]) => [key, Math.round(value)]),
  )
}

describe('hexToRgb', () => {
  it('should read six digits into channels', () => {
    expect(hexToRgb('ff8800')).toEqual(rgb(255, 136, 0))
  })

  it('should round trip through rgbToHex', () => {
    expect(rgbToHex(hexToRgb('7d2329'))).toBe('7d2329')
  })
})

describe('rgbToHex', () => {
  it('should round and clamp each channel', () => {
    expect(rgbToHex(rgb(300, 127.6, -4))).toBe('ff8000')
  })
})

describe('HSV', () => {
  it('should read white as no saturation and full value', () => {
    expect(rgbToHsv(rgb(255, 255, 255))).toEqual({ h: 0, s: 0, v: 100 })
  })

  it('should read black as no value', () => {
    expect(rgbToHsv(rgb(0, 0, 0))).toEqual({ h: 0, s: 0, v: 0 })
  })

  it('should read a pure primary at its hue', () => {
    expect(rgbToHsv(rgb(0, 0, 255))).toEqual({ h: 240, s: 100, v: 100 })
  })

  it('should round trip a mid grey', () => {
    expect(rgbToHex(hsvToRgb(rgbToHsv(hexToRgb('808080'))))).toBe('808080')
  })

  it('should keep the hue it was handed when saturation is zero', () => {
    expect(rgbToHsv(rgb(128, 128, 128), 200).h).toBe(200)
  })

  it('should write a grey whatever the hue', () => {
    expect(rgbToHex(hsvToRgb({ h: 200, s: 0, v: 50 }))).toBe('808080')
  })
})

describe('HSL', () => {
  it('should read white as full lightness', () => {
    expect(rgbToHsl(rgb(255, 255, 255))).toEqual({ h: 0, s: 0, l: 100 })
  })

  it('should read a pure primary at half lightness', () => {
    expect(rgbToHsl(rgb(0, 255, 0))).toEqual({ h: 120, s: 100, l: 50 })
  })

  it('should keep the hue it was handed when saturation is zero', () => {
    expect(rgbToHsl(rgb(0, 0, 0), 30).h).toBe(30)
  })

  it('should round trip a mid grey', () => {
    expect(rgbToHex(hslToRgb(rgbToHsl(hexToRgb('808080'))))).toBe('808080')
  })

  it('should write the hex an HSL row names', () => {
    expect(rgbToHex(hslToRgb({ h: 30, s: 100, l: 50 }))).toBe('ff8000')
  })
})

describe('LCH', () => {
  it('should read white as 100 0 0', () => {
    expect(rounded(rgbToLch(rgb(255, 255, 255)))).toEqual({
      l: 100,
      c: 0,
      h: 0,
    })
  })

  it('should read black as 0 0 0', () => {
    expect(rounded(rgbToLch(rgb(0, 0, 0)))).toEqual({ l: 0, c: 0, h: 0 })
  })

  it('should read sRGB red as the CSS definition gives it', () => {
    const red = rgbToLch(rgb(255, 0, 0))

    expect([red.l, red.c, red.h].map((value) => value.toFixed(1))).toEqual([
      '54.3',
      '106.8',
      '40.9',
    ])
  })

  it('should write the CSS sample lch(29.2345% 44.2 27) as its hex', () => {
    const result = lchToRgb({ l: 29.2345, c: 44.2, h: 27 })

    expect(rgbToHex(result.rgb)).toBe('7d2329')
  })

  it('should report an in-gamut color as unclamped', () => {
    expect(lchToRgb({ l: 29.2345, c: 44.2, h: 27 }).isClamped).toBe(false)
  })

  it('should clamp an out-of-gamut chroma and say so', () => {
    const result = lchToRgb({ l: 50, c: 150, h: 30 })

    expect(result.isClamped).toBe(true)
    expect(Object.values(result.rgb).every((v) => v >= 0 && v <= 255)).toBe(
      true,
    )
  })

  it('should round trip a mid grey', () => {
    expect(rgbToHex(lchToRgb(rgbToLch(hexToRgb('808080'))).rgb)).toBe('808080')
  })

  it('should keep the hue it was handed when chroma is zero', () => {
    expect(rgbToLch(rgb(255, 255, 255), 120).h).toBe(120)
  })
})
