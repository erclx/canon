import { bareHex, colorValue, TOKENS } from '@/design/tokens'

export type Variant = 'light' | 'dark'

export interface Theme {
  background: string
  surface: string
  ink: string
  muted: string
  accent: string
}

/**
 * Which role in `@/design/tokens` fills each slot of a slide theme. The names
 * differ because a deck names a slot by what sits in it and the record names a
 * role by what it is for, and mapping the two here is the whole of the adapter.
 */
const ROLES: Record<keyof Theme, readonly [dark: string, light: string]> = {
  background: ['background', 'light-background'],
  surface: ['surface', 'light-surface'],
  ink: ['text', 'light-text'],
  muted: ['text-secondary', 'light-muted'],
  accent: ['accent', 'light-accent'],
}

/**
 * `PptxGenJS` takes one installed family name where the record declares a
 * stack, and a `.pptx` cannot embed the face. The first family is taken with
 * its ` Variable` suffix dropped, since that suffix names the CSS package and
 * not the installed family, and PowerPoint picks its own substitute when the
 * face is missing.
 */
function familyName(role: string): string {
  const token = TOKENS.typography.find((entry) => entry.role === role)
  const family = token?.family
    .split(',')[0]
    ?.trim()
    .replace(/ Variable$/, '')
  if (!family) {
    throw new Error(`The design record declares no ${role} type role`)
  }

  return family
}

export const FONTS = {
  heading: familyName('display'),
  body: familyName('body'),
} as const

/**
 * Deck-owned point sizes. The record's `t0` to `t6` steps are screen pixels,
 * which read as points on a 13.33 inch slide would shrink the cover to 38 and
 * the body to 11, so only the face and the colors come from the record.
 */
export const TYPE = {
  cover: 44,
  section: 40,
  title: 30,
  body: 16,
  stat: 54,
  quote: 30,
  caption: 11,
} as const

/**
 * Builds a theme from the design source in the form this renderer can take.
 *
 * `src/slides/render.ts` hands color to `PptxGenJS` as `{ color: theme.background }`
 * and PowerPoint has no concept of a custom property, so the shared thing is the
 * value and bare hex is the per-consumer form. Every CSS surface takes the same
 * values through `@/design/css` instead.
 *
 * A role the record does not declare throws rather than rendering a slide in a
 * default nobody chose, since a missing color reaches a reader as a deck that
 * looks wrong with nothing saying why.
 */
export function buildTheme(variant: Variant): Theme {
  const pick = (slot: keyof Theme): string => {
    const role = ROLES[slot][variant === 'dark' ? 0 : 1]
    const value = colorValue(role)
    if (value === undefined) {
      throw new Error(`The design record declares no ${role} role`)
    }

    return bareHex(value)
  }

  return {
    background: pick('background'),
    surface: pick('surface'),
    ink: pick('ink'),
    muted: pick('muted'),
    accent: pick('accent'),
  }
}
