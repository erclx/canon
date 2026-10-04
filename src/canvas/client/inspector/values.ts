/**
 * How the inspector reads a computed value and writes a typed one back. A
 * field shows the formatted form, and only a value the operator changed goes
 * back through `toCssValue`, so rounding never writes a value nobody typed.
 */

/** A length that runs below zero, so a bare number is pixels and unclamped. */
const SIGNED_LENGTHS = new Set(['letter-spacing'])

/** Properties whose bare numbers are pixel lengths. */
const LENGTHS = new Set([
  'width',
  'height',
  'padding',
  'gap',
  'font-size',
  'border-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
])

/** Properties a size mode writes, each mode by the name the field shows. */
const SIZES = new Set(['width', 'height'])
const SIZE_MODES: Readonly<Record<string, string>> = {
  Fill: '100%',
  Fit: 'fit-content',
}

const PX = /^(-?\d*\.?\d+)px$/
const EM = /^(-?\d*\.?\d+)em$/
const NUMBER = /^-?\d*\.?\d+$/

function formatPx(token: string): string {
  const match = token.match(PX)
  if (!match) return token
  const value = Number(match[1])
  return String(
    Math.abs(value) < 10 ? Math.round(value * 10) / 10 : Math.round(value),
  )
}

/** A color that paints nothing, which the panel reads as no fill. */
export function isNoFill(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '')
  return normalized === 'transparent' || normalized === 'rgba(0,0,0,0)'
}

export function displayValue(property: string, raw: string): string {
  const value = raw.trim()
  if (property === 'gap' && (value === '' || value === 'normal')) return ''
  if (property === 'letter-spacing') {
    if (value === 'normal') return ''
    const em = value.match(EM)
    if (em) return `${Math.round(Number(em[1]) * 1000) / 1000}em`
  }
  if (property === 'background-color' && isNoFill(value)) return ''
  if (property === 'opacity' && value !== '')
    return `${Math.round(Number(value) * 100)}%`
  if (SIZES.has(property)) {
    const mode = Object.keys(SIZE_MODES).find(
      (name) => SIZE_MODES[name] === value,
    )
    if (mode) return mode
  }
  if (value === 'auto') return 'Auto'
  if (value === 'normal') return 'Normal'
  return value.split(/\s+/).map(formatPx).join(' ')
}

export function toCssValue(property: string, typed: string): string {
  const value = typed.trim()
  /* A line height has no auto keyword, so the field's Auto is its normal. */
  if (property === 'line-height' && value === 'Auto') return 'normal'
  if (value === 'Auto' || value === 'Normal') return value.toLowerCase()
  if (SIZES.has(property) && SIZE_MODES[value]) return SIZE_MODES[value]
  if (!LENGTHS.has(property) && !SIGNED_LENGTHS.has(property)) return value
  return value
    .split(/\s+/)
    .map((token) => (/^-?\d*\.?\d+$/.test(token) ? `${token}px` : token))
    .join(' ')
}

/** A typed opacity percent as the fraction CSS takes, refused outside 0 to 100. */
export function opacityToCss(typed: string): string | undefined {
  const percent = readOpacity(typed)
  return percent === undefined ? undefined : String(percent / 100)
}

/**
 * The radius all four corners share, read in the order the longhands run,
 * or undefined where any corner differs and the panel shows each one.
 */
export function sharedRadius(corners: readonly string[]): string | undefined {
  const [first] = corners
  return corners.every((corner) => corner === first) ? first : undefined
}

/**
 * Holds a scrubbed number inside what the property accepts. The writer takes
 * any declaration that does not break the rule, so a negative length or a
 * weight past 1000 would reach the file and the browser would drop it there.
 */
export function clampScrub(property: string, value: number): number {
  if (property === 'font-weight') return Math.min(1000, Math.max(1, value))
  if (LENGTHS.has(property) || property === 'line-height') {
    return Math.max(0, value)
  }
  return value
}

/**
 * A line height as the panel shows it: a ratio of the font size, the way a
 * unitless value writes it. A browser computes a unitless value to pixels, so
 * a pixel value reads back as its ratio when the font size is in pixels too.
 */
export function lineHeightValue(raw: string, fontSize: string): string {
  const value = raw.trim()
  if (value === 'normal') return 'Auto'
  const ratio = (number: number): string =>
    String(Math.round(number * 100) / 100)
  if (NUMBER.test(value)) return ratio(Number(value))
  const height = value.match(PX)
  const size = fontSize.trim().match(PX)
  if (height && size && Number(size[1]) > 0) {
    return ratio(Number(height[1]) / Number(size[1]))
  }
  return value
}

/** The first family of a stack, unquoted, which is the one the field names. */
export function firstFamily(stack: string): string {
  const value = stack.trim()
  if (value.startsWith('var(')) return value
  const [first = ''] = value.split(',')
  return first.trim().replace(/^(["'])(.*)\1$/, '$2')
}

/**
 * Text alignment by the side it lands on, so the group presses the side the
 * text paints on. The logical keywords turn on the element's direction.
 */
export function textAlignOf(computed: string, direction: string): string {
  const value = computed.trim()
  const isRtl = direction.trim() === 'rtl'
  if (value === 'start') return isRtl ? 'right' : 'left'
  if (value === 'end') return isRtl ? 'left' : 'right'
  return value
}

/**
 * A value as the writer takes it. A whole declaration pasted from a
 * stylesheet keeps its value alone, since the writer refuses the semicolon.
 */
export function declarationValue(property: string, typed: string): string {
  const value = typed.trim().replace(/;\s*$/, '')
  const prefix = `${property}:`
  return value.toLowerCase().startsWith(prefix)
    ? value.slice(prefix.length).trim()
    : value
}

/** The token a value names when it is a bare `var()` and nothing else. */
export function tokenOf(value: string): string | undefined {
  return value.trim().match(VAR)?.[1]
}

/** Units a scrub moves for each pixel the pointer travels. */
export function scrubStep(isCoarse: boolean): number {
  return isCoarse ? 10 : 1
}

/** A color the picker can write: a token or a hex, each with an opacity. */
export type WrittenColor =
  | {
      readonly kind: 'token'
      /** The custom property name as the token sheet gives it. */
      readonly name: string
      readonly opacity: number
    }
  | { readonly kind: 'hex'; readonly hex: string; readonly opacity: number }

export type ParsedColor = WrittenColor | { readonly kind: 'none' }

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGB =
  /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i
/** What a browser computes `color-mix()` in srgb to, channels 0 to 1. */
const SRGB =
  /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i
const VAR = /^var\(\s*(--[\w-]+)\s*\)$/i
const MIX =
  /^color-mix\(\s*in\s+srgb\s*,\s*var\(\s*(--[\w-]+)\s*\)\s+([\d.]+)%\s*,\s*transparent\s*\)$/i

function channel(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, '0')
}

/**
 * An alpha as a percent. A value past 1 clamps to full rather than reading as
 * a 0 to 255 scale, since CSS clamps it the same way when it paints.
 */
function alphaPercent(alpha: string | undefined): number {
  if (alpha === undefined) return 100
  const fraction = alpha.endsWith('%')
    ? Number(alpha.slice(0, -1)) / 100
    : Number(alpha)
  return Math.round(Math.min(1, Math.max(0, fraction)) * 100)
}

/** A typed hex in any of its lengths, normalized to six digits. */
export function readHex(
  typed: string,
): { readonly hex: string; readonly opacity?: number } | undefined {
  const match = typed.trim().match(HEX)
  if (!match) return undefined
  const digits = match[1].toLowerCase()
  const full =
    digits.length <= 4
      ? [...digits].map((digit) => digit + digit).join('')
      : digits
  const hex = full.slice(0, 6)
  if (full.length === 6) return { hex }
  return {
    hex,
    opacity: Math.round((parseInt(full.slice(6), 16) / 255) * 100),
  }
}

/** A typed opacity percent, refused outside 0 to 100. */
export function readOpacity(typed: string): number | undefined {
  const value = typed.trim().replace(/%$/, '')
  if (!/^-?\d*\.?\d+$/.test(value)) return undefined
  const percent = Number(value)
  return percent >= 0 && percent <= 100 ? Math.round(percent) : undefined
}

/**
 * Reads a computed or inline color into what the picker shows. A form it does
 * not know, such as a named color, comes back undefined.
 */
export function parseColor(value: string): ParsedColor | undefined {
  const text = value.trim()
  if (isNoFill(text)) return { kind: 'none' }
  const token = text.match(VAR)
  if (token) return { kind: 'token', name: token[1], opacity: 100 }
  const mix = text.match(MIX)
  if (mix) {
    return {
      kind: 'token',
      name: mix[1],
      opacity: Math.round(Math.min(100, Number(mix[2]))),
    }
  }
  const hex = text.startsWith('#') ? readHex(text) : undefined
  if (hex) return painted(hex.hex, hex.opacity ?? 100)
  const rgb = text.match(RGB)
  if (rgb) {
    return painted(
      [rgb[1], rgb[2], rgb[3]].map((part) => channel(Number(part))).join(''),
      alphaPercent(rgb[4]),
    )
  }
  const srgb = text.match(SRGB)
  if (!srgb) return undefined
  return painted(
    [srgb[1], srgb[2], srgb[3]]
      .map((part) => channel(Number(part) * 255))
      .join(''),
    alphaPercent(srgb[4]),
  )
}

/** A color at zero opacity paints nothing, whichever form wrote it. */
function painted(hex: string, opacity: number): ParsedColor {
  return opacity === 0 ? { kind: 'none' } : { kind: 'hex', hex, opacity }
}

/**
 * The value a pick writes. A token below full opacity mixes with transparent
 * rather than resolving to a hex, so it keeps following the theme.
 */
export function composeColor(color: WrittenColor): string {
  if (color.kind === 'token') {
    return color.opacity >= 100
      ? `var(${color.name})`
      : `color-mix(in srgb, var(${color.name}) ${color.opacity}%, transparent)`
  }
  return color.opacity >= 100
    ? `#${color.hex}`
    : `#${color.hex}${channel((color.opacity / 100) * 255)}`
}
