/**
 * Conversions between the hex the writer takes and the spaces the picker
 * edits in. Channels are 0 to 255, hues are degrees, and every other component
 * is 0 to 100. LCH is CIE LCH as CSS `lch()` defines it, and the matrices are
 * the ones CSS Color 4 publishes in its sample code.
 */

export interface Rgb {
  readonly r: number
  readonly g: number
  readonly b: number
}

export interface Hsv {
  readonly h: number
  readonly s: number
  readonly v: number
}

export interface Hsl {
  readonly h: number
  readonly s: number
  readonly l: number
}

export interface Lch {
  readonly l: number
  readonly c: number
  readonly h: number
}

type Vector = readonly [number, number, number]
type Matrix = readonly [Vector, Vector, Vector]

const LINEAR_SRGB_TO_XYZ: Matrix = [
  [506752 / 1228815, 87881 / 245763, 12673 / 70218],
  [87098 / 409605, 175762 / 245763, 12673 / 175545],
  [7918 / 409605, 87881 / 737289, 1001167 / 1053270],
]

const XYZ_TO_LINEAR_SRGB: Matrix = [
  [12831 / 3959, -329 / 214, -1974 / 3959],
  [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
  [705 / 12673, -2585 / 12673, 705 / 667],
]

/** Bradford chromatic adaptation, since sRGB is D65 and `lch()` is D50. */
const D65_TO_D50: Matrix = [
  [1.0479297925449969, 0.022946870601609652, -0.05019226628920524],
  [0.02962780877005599, 0.9904344267538799, -0.017073799063418826],
  [-0.009243040646204504, 0.015055191490298152, 0.7518742814281371],
]

const D50_TO_D65: Matrix = [
  [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
  [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
  [0.012314014864481998, -0.020507649298898964, 1.330365926242124],
]

const D50_WHITE: Vector = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585]

const EPSILON = 216 / 24389
const KAPPA = 24389 / 27

/** Chroma below this reads as no hue, which rounding noise never reaches. */
const ACHROMATIC = 0.02

function multiply(matrix: Matrix, vector: Vector): Vector {
  const [row0, row1, row2] = matrix.map(
    (row) => row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2],
  )
  return [row0 ?? 0, row1 ?? 0, row2 ?? 0]
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

function wrapHue(hue: number): number {
  return ((hue % 360) + 360) % 360
}

export function hexToRgb(hex: string): Rgb {
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  return [r, g, b]
    .map((part) =>
      Math.round(clamp(part, 0, 255))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
}

/**
 * HSV off RGB. A color with no saturation has no hue of its own, so it takes
 * the one handed in, which keeps a grey's hue slider where the operator left it.
 */
export function rgbToHsv({ r, g, b }: Rgb, hue = 0): Hsv {
  const max = Math.max(r, g, b)
  const delta = max - Math.min(r, g, b)
  return {
    h: delta === 0 ? hue : hueOf(r, g, b, max, delta),
    s: max === 0 ? 0 : (delta / max) * 100,
    v: (max / 255) * 100,
  }
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const value = (v / 100) * 255
  const chroma = value * (s / 100)
  return fromChroma(h, chroma, value - chroma)
}

/** HSL off RGB, taking the hue handed in when there is no saturation. */
export function rgbToHsl({ r, g, b }: Rgb, hue = 0): Hsl {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  const lightness = (max + min) / 2 / 255
  const saturation =
    delta === 0 ? 0 : delta / 255 / (1 - Math.abs(2 * lightness - 1))
  return {
    h: delta === 0 ? hue : hueOf(r, g, b, max, delta),
    s: saturation * 100,
    l: lightness * 100,
  }
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const lightness = l / 100
  const chroma = (1 - Math.abs(2 * lightness - 1)) * (s / 100) * 255
  return fromChroma(h, chroma, lightness * 255 - chroma / 2)
}

function hueOf(
  r: number,
  g: number,
  b: number,
  max: number,
  delta: number,
): number {
  const sector =
    max === r
      ? (g - b) / delta + (g < b ? 6 : 0)
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4
  return sector * 60
}

function fromChroma(hue: number, chroma: number, base: number): Rgb {
  const sector = wrapHue(hue) / 60
  const second = chroma * (1 - Math.abs((sector % 2) - 1))
  const [r, g, b]: Vector =
    sector < 1
      ? [chroma, second, 0]
      : sector < 2
        ? [second, chroma, 0]
        : sector < 3
          ? [0, chroma, second]
          : sector < 4
            ? [0, second, chroma]
            : sector < 5
              ? [second, 0, chroma]
              : [chroma, 0, second]
  return { r: r + base, g: g + base, b: b + base }
}

function toLinear(channel: number): number {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function fromLinear(value: number): number {
  const encoded =
    value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055
  return encoded * 255
}

/** CIE LCH off RGB, taking the hue handed in when there is no chroma. */
export function rgbToLch({ r, g, b }: Rgb, hue = 0): Lch {
  const xyz = multiply(
    D65_TO_D50,
    multiply(LINEAR_SRGB_TO_XYZ, [toLinear(r), toLinear(g), toLinear(b)]),
  )
  const f = (ratio: number): number =>
    ratio > EPSILON ? Math.cbrt(ratio) : (KAPPA * ratio + 16) / 116
  const fx = f(xyz[0] / D50_WHITE[0])
  const fy = f(xyz[1] / D50_WHITE[1])
  const fz = f(xyz[2] / D50_WHITE[2])
  const a = 500 * (fx - fy)
  const bAxis = 200 * (fy - fz)
  const chroma = Math.sqrt(a * a + bAxis * bAxis)
  return {
    l: 116 * fy - 16,
    c: chroma < ACHROMATIC ? 0 : chroma,
    h:
      chroma < ACHROMATIC
        ? hue
        : wrapHue((Math.atan2(bAxis, a) * 180) / Math.PI),
  }
}

/**
 * RGB off CIE LCH. A color outside sRGB has no faithful hex, so each channel
 * clamps and `isClamped` says so, letting the row show the color written.
 */
export function lchToRgb({ l, c, h }: Lch): {
  readonly rgb: Rgb
  readonly isClamped: boolean
} {
  const radians = (h * Math.PI) / 180
  const fy = (l + 16) / 116
  const fx = fy + (c * Math.cos(radians)) / 500
  const fz = fy - (c * Math.sin(radians)) / 200
  const ratios: Vector = [
    fx ** 3 > EPSILON ? fx ** 3 : (116 * fx - 16) / KAPPA,
    l > KAPPA * EPSILON ? fy ** 3 : l / KAPPA,
    fz ** 3 > EPSILON ? fz ** 3 : (116 * fz - 16) / KAPPA,
  ]
  const xyz: Vector = [
    ratios[0] * D50_WHITE[0],
    ratios[1] * D50_WHITE[1],
    ratios[2] * D50_WHITE[2],
  ]
  const channels = multiply(XYZ_TO_LINEAR_SRGB, multiply(D50_TO_D65, xyz)).map(
    fromLinear,
  )
  /* Half a step either side rounds into range, so it is not a clamp. */
  const isClamped = channels.some((part) => part < -0.5 || part > 255.5)
  const [r, g, b] = channels.map((part) => clamp(part, 0, 255))
  return { rgb: { r: r ?? 0, g: g ?? 0, b: b ?? 0 }, isClamped }
}
