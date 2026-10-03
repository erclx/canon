/**
 * How the inspector reads a computed value and writes a typed one back. A
 * field shows the formatted form, and only a value the operator changed goes
 * back through `toCssValue`, so rounding never writes a value nobody typed.
 */

/** Properties whose bare numbers are pixel lengths. */
const LENGTHS = new Set(['width', 'height', 'padding', 'gap', 'font-size'])

const PX = /^(-?\d*\.?\d+)px$/

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
  if (property === 'background-color' && isNoFill(value)) return ''
  if (value === 'auto') return 'Auto'
  if (value === 'normal') return 'Normal'
  return value.split(/\s+/).map(formatPx).join(' ')
}

export function toCssValue(property: string, typed: string): string {
  const value = typed.trim()
  if (value === 'Auto' || value === 'Normal') return value.toLowerCase()
  if (!LENGTHS.has(property)) return value
  return value
    .split(/\s+/)
    .map((token) => (/^-?\d*\.?\d+$/.test(token) ? `${token}px` : token))
    .join(' ')
}

/** Units a scrub moves for each pixel the pointer travels. */
export function scrubStep(isCoarse: boolean): number {
  return isCoarse ? 10 : 1
}
