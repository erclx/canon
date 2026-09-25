import type { ColorToken, DesignTokens } from '@/design/tokens'
import { TOKENS } from '@/design/tokens'

/**
 * The token set `canon design install` hands a target, achromatic so the only
 * palette a target renders is one it wrote under `.claude/design/project/`.
 * Type, spacing, and radii are this repository's by spread, and only the color
 * list is a second copy, held to the same roles by `neutral.test.ts`.
 *
 * Grounds, surface, chrome, and border take the OKLCH lightness of the toolkit
 * role they replace at chroma 0. Text roles are solved against `surface` for
 * the contrast targets `TOKENS` records (13.5, 8.6, 5.6, 4.6), and the accent
 * for 15.5, past `text` so it still reads apart from body copy. The state
 * roles keep the toolkit's values, since a state color is a meaning rather
 * than a palette.
 */

const DARK_GROUNDS = ['background', 'surface'] as const
const LIGHT_GROUNDS = ['light-background', 'light-surface'] as const

function toolkitRole(role: string): ColorToken {
  const token = TOKENS.color.find((candidate) => candidate.role === role)
  if (token === undefined) throw new Error(`TOKENS declares no ${role} role`)
  return token
}

const NEUTRAL_COLOR: readonly ColorToken[] = [
  { role: 'background', intent: 'page canvas', value: '#0e0e0e' },
  {
    role: 'surface',
    intent: 'cards, panels, raised blocks',
    value: '#141414',
  },
  {
    role: 'chrome',
    intent: 'the window titlebar, one step above the canvas',
    value: '#1a1a1a',
  },
  { role: 'border', intent: 'every rule and panel edge', value: '#292929' },
  {
    role: 'text',
    intent: 'headings, counts, emphasized runs',
    value: '#dddddd',
    grounds: DARK_GROUNDS,
  },
  {
    role: 'text-body',
    intent: 'default body copy',
    value: '#b2b2b2',
    grounds: DARK_GROUNDS,
  },
  {
    role: 'text-secondary',
    intent: 'labels, captions, supporting copy',
    value: '#8e8e8e',
    grounds: DARK_GROUNDS,
  },
  {
    role: 'muted',
    intent: 'the faintest step, trailing notes',
    value: '#7f7f7f',
    grounds: DARK_GROUNDS,
  },
  {
    role: 'accent',
    intent: 'install command, mark, primary action',
    value: '#ececec',
    grounds: DARK_GROUNDS,
  },
  toolkitRole('success'),
  toolkitRole('warning'),
  toolkitRole('error'),
  {
    role: 'light-background',
    intent: 'page canvas on a light ground',
    value: '#fafafa',
  },
  {
    role: 'light-surface',
    intent: 'cards and panels on a light ground',
    value: '#f1f1f1',
  },
  {
    role: 'light-chrome',
    intent: 'the window titlebar, one step above the canvas',
    value: '#e8e8e8',
  },
  {
    role: 'light-text',
    intent: 'primary text on a light ground',
    value: '#252525',
    grounds: LIGHT_GROUNDS,
  },
  {
    role: 'light-text-body',
    intent: 'default body copy on a light ground',
    value: '#444444',
    grounds: LIGHT_GROUNDS,
  },
  {
    role: 'light-text-secondary',
    intent: 'labels, captions, supporting copy on a light ground',
    value: '#5f5f5f',
    grounds: LIGHT_GROUNDS,
  },
  {
    role: 'light-muted',
    intent: 'secondary text on a light ground',
    value: '#6c6c6c',
    grounds: LIGHT_GROUNDS,
  },
  {
    role: 'light-accent',
    intent: 'links and primary action on light',
    value: '#191919',
    grounds: LIGHT_GROUNDS,
  },
  toolkitRole('light-success'),
  {
    role: 'light-border',
    intent: 'rules and panel edges on light',
    value: '#d4d4d4',
    verify: true,
  },
]

export const NEUTRAL_TOKENS: DesignTokens = { ...TOKENS, color: NEUTRAL_COLOR }
