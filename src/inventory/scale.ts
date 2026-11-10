import { existsSync } from 'node:fs'
import {
  type Cell,
  parseDesignDoc,
  parseSectionTables,
  type Row,
} from '@/design/parse'

/**
 * Reads what a design record carries for each value subject, in the form the
 * page reader reports, so a listing's values and the record's meet as strings.
 *
 * A values record writes a token the way a person types it, such as `5.625rem`
 * or `0 0 0 1px rgba(0,0,0,.07)`, and the browser computes it as `90px` or
 * `rgba(0, 0, 0, 0.07) 0px 0px 0px 1px`. Each normalizer here turns the first
 * form into the second, and the page reader in `values.ts` does the same for
 * what the browser hands it, which is the one pair of rules the two must share.
 */

export const VALUE_SUBJECTS = [
  'color',
  'font-size',
  'radius',
  'shadow',
  'duration',
] as const

export type ValueSubject = (typeof VALUE_SUBJECTS)[number]

/**
 * `no-values` covers an intent record, which names each role's custom property
 * and leaves the value to the stylesheet its lead names. That stylesheet goes
 * unread, so the total line says the comparison is missing rather than zero.
 */
export type Scale =
  | { readonly kind: 'values'; readonly values: readonly string[] }
  | { readonly kind: 'no-values' }
  | { readonly kind: 'no-record' }

/** The root size a rem in the record resolves against. */
const ROOT_PX = 16

export function readScale(path: string, subject: ValueSubject): Scale {
  if (!existsSync(path)) return { kind: 'no-record' }
  const values = distinct(
    cellsFor(path, subject).flatMap(normalizerFor(subject)),
  )
  return values.length === 0
    ? { kind: 'no-values' }
    : { kind: 'values', values }
}

function cellsFor(path: string, subject: ValueSubject): string[] {
  const doc = parseDesignDoc(path)
  switch (subject) {
    case 'color':
      return column(doc.color, 'Value')
    case 'font-size':
      return ['Size', 'Tablet', 'Phone'].flatMap((key) =>
        column(doc.typography, key),
      )
    case 'radius':
      return column(doc.borders, 'Radius')
    case 'shadow':
      return parseSectionTables(path, 'Shapes')
        .slice(1)
        .flatMap((rows) => column(rows, 'Value'))
    case 'duration':
      return parseSectionTables(path, 'Motion').flatMap((rows) =>
        column(rows, 'Value'),
      )
  }
}

function column(rows: readonly Row[], key: string): string[] {
  return rows
    .map((row): Cell | undefined => row[key])
    .filter((cell): cell is Cell => cell !== undefined)
    .map((cell) => cell.value.replace(/^`|`$/g, '').trim())
    .filter((value) => value !== '')
}

const NORMALIZERS: Record<ValueSubject, (raw: string) => string | undefined> = {
  color: (raw) => normalizeColor(raw),
  'font-size': (raw) => normalizeLength(raw),
  radius: (raw) => normalizeLength(raw),
  shadow: (raw) => normalizeShadow(raw),
  duration: (raw) => normalizeDuration(raw),
}

function normalizerFor(subject: ValueSubject): (raw: string) => string[] {
  return (raw) => {
    const value = NORMALIZERS[subject](raw)
    return value === undefined ? [] : [value]
  }
}

function distinct(values: readonly string[]): string[] {
  return [...new Set(values)]
}

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGB = /^rgba?\(\s*([^)]*)\)$/i

/**
 * Lowercase `#rrggbb` for an opaque color and `rgba(r, g, b, a)` for one with
 * alpha, the form the page reader writes. A named color or a token that is no
 * color at all, such as an ANSI code, reads as nothing.
 */
export function normalizeColor(raw: string): string | undefined {
  const value = raw.trim().toLowerCase()
  const hex = value.match(HEX)?.[1]
  if (hex) {
    const full =
      hex.length <= 4 ? [...hex].map((digit) => digit + digit).join('') : hex
    const channels = [0, 2, 4, 6]
      .map((at) => full.slice(at, at + 2))
      .filter((pair) => pair !== '')
      .map((pair) => Number.parseInt(pair, 16))
    const [r = 0, g = 0, b = 0, a = 255] = channels
    return rgbaForm(r, g, b, a / 255)
  }
  const rgb = value.match(RGB)?.[1]
  if (rgb === undefined) return undefined
  const parts = rgb
    .split(/[\s,/]+/)
    .filter((part) => part !== '')
    .map((part) =>
      part.endsWith('%') ? Number.parseFloat(part) / 100 : Number(part),
    )
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) {
    return undefined
  }
  const [r = 0, g = 0, b = 0, a = 1] = parts
  return rgbaForm(r, g, b, a)
}

function rgbaForm(r: number, g: number, b: number, alpha: number): string {
  const a = Math.round(alpha * 1000) / 1000
  if (a >= 1) {
    return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
  }
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

/** A length in px at a 16px root, `0` and `none` reading as nothing. */
export function normalizeLength(raw: string): string | undefined {
  const match = raw.trim().match(/^(-?\d*\.?\d+)(px|rem)?$/)
  if (!match) return undefined
  const amount = Number(match[1]) * (match[2] === 'rem' ? ROOT_PX : 1)
  if (amount === 0) return undefined
  return `${Math.round(amount * 1000) / 1000}px`
}

/** A duration in whole milliseconds, `0s` reading as nothing. */
export function normalizeDuration(raw: string): string | undefined {
  const match = raw.trim().match(/^(\d*\.?\d+)(ms|s)$/)
  if (!match) return undefined
  const ms = Number(match[1]) * (match[2] === 's' ? 1000 : 1)
  return ms === 0 ? undefined : `${Math.round(ms)}ms`
}

/**
 * The computed form of a `box-shadow`, being each layer as its color, its
 * lengths in px, then `inset`, joined by `, `. A layer whose color the record
 * names by keyword is left as written.
 */
export function normalizeShadow(raw: string): string | undefined {
  const value = raw.trim()
  if (value === '' || value === 'none') return undefined
  return splitLayers(value)
    .map((layer) => {
      const tokens: string[] =
        layer.match(/rgba?\([^)]*\)|#[0-9a-f]+|[^\s]+/gi) ?? []
      const inset = tokens.includes('inset')
      const lengths: string[] = []
      let color = ''
      for (const token of tokens) {
        if (token === 'inset') continue
        if (/^-?\d*\.?\d+(px)?$/.test(token)) {
          lengths.push(`${Number.parseFloat(token)}px`)
        } else {
          color = normalizeColor(token) ?? token
        }
      }
      return [color, ...lengths, ...(inset ? ['inset'] : [])]
        .filter((part) => part !== '')
        .join(' ')
    })
    .join(', ')
}

/** Splits on the commas between layers, never on one inside `rgba()`. */
function splitLayers(value: string): string[] {
  const layers: string[] = []
  let depth = 0
  let current = ''
  for (const char of value) {
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (char === ',' && depth === 0) {
      layers.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim() !== '') layers.push(current.trim())
  return layers
}
