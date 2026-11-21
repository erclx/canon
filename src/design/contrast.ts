import type { ColorToken } from '@/design/tokens'
import { TOKENS } from '@/design/tokens'

/** WCAG 2.1 AA for body copy. Every role a surface renders as text clears it. */
export const AA_TEXT = 4.5

/** WCAG 2.1 AA for a large or non-text element, kept as the floor a reading is read against. */
export const AA_NON_TEXT = 3

const HEX = /^#[0-9a-fA-F]{6}$/

/**
 * Relative luminance per WCAG 2.1. Only six-digit hex is accepted, since the
 * record also carries ANSI codes that no ratio applies to and silently reading
 * one as a color would report a passing number for a value nothing renders.
 */
export function luminance(hex: string): number {
  if (!HEX.test(hex)) throw new Error(`Not a six-digit hex color: ${hex}`)

  const channels = [1, 3, 5].map(
    (start) => parseInt(hex.slice(start, start + 2), 16) / 255,
  )
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )

  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

/** The WCAG ratio between two colors, lighter over darker, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort(
    (first, second) => second - first,
  )

  return (lighter + 0.05) / (darker + 0.05)
}

export interface Reading {
  readonly role: string
  readonly ground: string
  readonly ratio: number
  readonly passes: boolean
}

/**
 * Every reading the record declares, one per role and ground pair. A role naming
 * no ground contributes none, which keeps a ground and the ANSI roles out of the set.
 */
export function readings(
  tokens: readonly ColorToken[] = TOKENS.color,
): Reading[] {
  const values = new Map(tokens.map((token) => [token.role, token.value]))
  const out: Reading[] = []

  for (const token of tokens) {
    for (const ground of token.grounds ?? []) {
      const behind = values.get(ground)
      if (behind === undefined) {
        throw new Error(`${token.role} names an unknown ground: ${ground}`)
      }

      const ratio = contrastRatio(token.value, behind)
      out.push({
        role: token.role,
        ground,
        ratio,
        passes: ratio >= AA_TEXT,
      })
    }
  }

  return out
}

/** Readings below AA, which is the list the test asserts is empty. */
export function failing(tokens?: readonly ColorToken[]): Reading[] {
  return readings(tokens).filter((reading) => !reading.passes)
}
