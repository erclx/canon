/**
 * The design system's one source of values.
 *
 * `canon/DESIGN.md` is rendered from this module rather than read by it, so
 * the document a person opens is a view and this file is the fact. A CSS
 * surface reads it as custom properties through `@/design/css`.
 *
 * The two artifacts can disagree, which is what the `design` gate stage exists
 * to catch. Nothing else compares them.
 */

/** A color role, its purpose, and the value every surface renders it at. */
export interface ColorToken {
  readonly role: string
  readonly intent: string
  readonly value: string
  /**
   * Roles this one is rendered on top of, named rather than spelled so a ground
   * moving carries every reading measured against it. Empty on a ground itself
   * and on a role with no hex value to measure.
   */
  readonly grounds?: readonly string[]
  /**
   * No rendering surface exercises this value yet, so it is a declaration the
   * system has not tested rather than one it has. Rendered as `? verify`.
   */
  readonly verify?: boolean
}

export interface TypeToken {
  readonly role: string
  readonly family: string
  readonly weight: string
  readonly size: string
  readonly lineHeight: string
  readonly verify?: readonly ('family' | 'weight' | 'size' | 'lineHeight')[]
}

/** One size the system offers, named apart from any role that takes it. */
export interface TypeStep {
  readonly step: string
  readonly size: string
}

export interface SpaceToken {
  readonly step: string
  readonly multiplier: string
  readonly value: string
}

export interface BorderToken {
  readonly role: string
  readonly radius: string
  readonly width: string
  readonly when: string
  readonly verify?: readonly ('radius' | 'width')[]
}

/**
 * Every prose slot is a list of one-line rules rather than a string, so a
 * bullet is the unit the renderer emits and the prose budget counts, and a
 * value needing a paragraph of why goes to `canon/context/design/tokens.md`.
 */
export interface DesignTokens {
  readonly personality: string
  readonly color: readonly ColorToken[]
  readonly colorRules: readonly string[]
  readonly typeScale: readonly TypeStep[]
  readonly typography: readonly TypeToken[]
  readonly typographyRules: readonly string[]
  readonly spacing: readonly SpaceToken[]
  readonly spacingRules: readonly string[]
  readonly borders: readonly BorderToken[]
  readonly bordersRules: readonly string[]
  readonly layout: readonly string[]
  readonly motion: readonly string[]
  readonly iconography: readonly string[]
}

/** The monospace stack, taken by code and by the terminal frames a page embeds. */
const MONO = 'Noto Sans Mono, DejaVu Sans Mono, monospace'

/**
 * The proportional stack every role but `code` declares. Geist is the face the
 * visual-direction track set throughout, embedded through `FONT_FACES`.
 *
 * The stack stops at two names and a generic because `src/design/base.css` is
 * written by `canon design regen` and formatted by prettier, and a declaration
 * past 80 columns is wrapped by the second and flattened by the first. Every
 * emitted line stays inside the width so the two writers never disagree.
 */
const SANS = 'Geist Variable, DejaVu Sans, sans-serif'

const DARK_GROUNDS = ['background', 'surface'] as const
const LIGHT_GROUNDS = ['light-background', 'light-surface'] as const

export const TOKENS: DesignTokens = {
  personality:
    'Warm neutrals under one rust accent, set in Geist. The page reads as prose, and monospace appears only where a surface shows what a shell printed. One accent carries every count, link, and primary action.',

  colorRules: [
    'One accent. Never promote a second color into a structural role.',
    'Every text role clears WCAG AA at 4.5:1 against each ground it is drawn on.',
    '`warning` and `error` exist only in the terminal, as ANSI codes.',
  ],

  color: [
    {
      role: 'background',
      intent: 'page canvas',
      value: '#0f0e0c',
    },
    {
      role: 'surface',
      intent: 'cards, panels, raised blocks',
      value: '#151412',
    },
    {
      role: 'chrome',
      intent: 'the window titlebar, one step above the canvas',
      value: '#1b1a18',
    },
    {
      role: 'border',
      intent: 'every rule and panel edge',
      value: '#2a2926',
    },
    {
      role: 'text',
      intent: 'headings, counts, emphasized runs',
      value: '#d9d7d4',
      grounds: DARK_GROUNDS,
    },
    {
      role: 'text-body',
      intent: 'default body copy',
      value: '#aeada9',
      grounds: DARK_GROUNDS,
    },
    {
      role: 'text-secondary',
      intent: 'labels, captions, supporting copy',
      value: '#8c8b86',
      grounds: DARK_GROUNDS,
    },
    {
      role: 'muted',
      intent: 'the faintest step, trailing notes',
      value: '#7f7f7c',
      grounds: DARK_GROUNDS,
    },
    {
      role: 'accent',
      intent: 'install command, mark, primary action',
      value: '#c76b5f',
      grounds: DARK_GROUNDS,
    },
    {
      role: 'success',
      intent: 'confirmations, rendered and in the terminal',
      value: '#61c454',
      grounds: ['background'],
    },
    { role: 'warning', intent: 'terminal cautions', value: 'ANSI 33' },
    { role: 'error', intent: 'terminal failures', value: 'ANSI 31' },
    {
      role: 'light-background',
      intent: 'page canvas on a light ground',
      value: '#fbfaf8',
    },
    {
      role: 'light-surface',
      intent: 'cards and panels on a light ground',
      value: '#f1f1ee',
    },
    {
      role: 'light-chrome',
      intent: 'the window titlebar, one step above the canvas',
      value: '#e9e8e5',
    },
    {
      role: 'light-text',
      intent: 'primary text on a light ground',
      value: '#2c2c29',
      grounds: LIGHT_GROUNDS,
    },
    {
      role: 'light-text-body',
      intent: 'default body copy on a light ground',
      value: '#4b4947',
      grounds: LIGHT_GROUNDS,
    },
    {
      role: 'light-text-secondary',
      intent: 'labels, captions, supporting copy on a light ground',
      value: '#666561',
      grounds: LIGHT_GROUNDS,
    },
    {
      role: 'light-muted',
      intent: 'secondary text on a light ground',
      value: '#6e6d6c',
      grounds: LIGHT_GROUNDS,
    },
    {
      role: 'light-accent',
      intent: 'links and primary action on light',
      value: '#ad4a4b',
      grounds: LIGHT_GROUNDS,
    },
    {
      role: 'light-success',
      intent: 'confirmations, rendered and in the terminal, on light',
      value: '#2d6b22',
      grounds: ['light-background'],
    },
    {
      role: 'light-border',
      intent: 'rules and panel edges on light',
      value: '#d5d4d1',
      verify: true,
    },
  ],

  typographyRules: [
    'Geist for every role except `code`, which is monospace.',
    'Tracking: `label` at `0.05em`, `display` at `-0.01em`, nothing else.',
    'Sizes come from seven steps, `t0` to `t6`. A role takes one step.',
  ],

  typeScale: [
    { step: 't0', size: '3.175rem' },
    { step: 't1', size: '2.375rem' },
    { step: 't2', size: '1.375rem' },
    { step: 't3', size: '1.125rem' },
    { step: 't4', size: '0.9375rem' },
    { step: 't5', size: '0.8125rem' },
    { step: 't6', size: '0.6875rem' },
  ],

  typography: [
    {
      role: 'display',
      family: SANS,
      weight: '700',
      size: '2.375rem',
      lineHeight: '1.3',
    },
    {
      role: 'page-display',
      family: SANS,
      weight: '700',
      size: '3.175rem',
      lineHeight: '1.1',
      verify: ['size', 'lineHeight'],
    },
    {
      role: 'heading',
      family: SANS,
      weight: '700',
      size: '1.375rem',
      lineHeight: '1.3',
      verify: ['lineHeight'],
    },
    {
      role: 'body',
      family: SANS,
      weight: '400',
      size: '0.9375rem',
      lineHeight: '1.65',
      verify: ['weight'],
    },
    {
      role: 'label',
      family: SANS,
      weight: '400',
      size: '0.8125rem',
      lineHeight: '1.45',
      verify: ['weight', 'lineHeight'],
    },
    {
      role: 'code',
      family: MONO,
      weight: '700',
      size: '0.8125rem',
      lineHeight: '1.3',
      verify: ['lineHeight'],
    },
  ],

  spacingRules: [
    'Seven steps. `md` sits at 3.5 because a control needs 14 pixels.',
  ],

  spacing: [
    { step: 'xs', multiplier: '1', value: '0.25rem' },
    { step: 'sm', multiplier: '2', value: '0.5rem' },
    { step: 'md', multiplier: '3.5', value: '0.875rem' },
    { step: 'lg', multiplier: '6', value: '1.5rem' },
    { step: 'xl', multiplier: '10', value: '2.5rem' },
    { step: '2xl', multiplier: '16', value: '4rem' },
    { step: '3xl', multiplier: '24', value: '6rem' },
  ],

  bordersRules: [
    'Every border is one pixel solid in `border`. Radius and width are independent.',
  ],

  borders: [
    {
      role: 'frame',
      radius: '12px',
      width: 'none',
      when: 'the outer window, radius only',
    },
    {
      role: 'panel',
      radius: '10px',
      width: '1px',
      when: 'cards and columns',
    },
    {
      role: 'action',
      radius: '7px',
      width: 'none',
      when: 'the install command block',
    },
    {
      role: 'rule',
      radius: 'none',
      width: '1px',
      when: 'horizontal dividers between bands',
    },
    {
      role: 'pill',
      radius: '999px',
      width: 'none',
      when: 'tags and status chips, none built',
      verify: ['radius', 'width'],
    },
    {
      role: 'marker',
      radius: '999px',
      width: 'none',
      when: 'the status dot, sized at 6px',
    },
  ],

  layout: [
    'Capture widths: 320, 768, 1280, 1536. 320 is the reflow floor.',
    'Every width query in the generated stylesheets opens a range one of these widths reaches.',
  ],

  motion: [
    'None. No transition, animation, or keyframe on any rendered surface.',
  ],

  iconography: [
    'No icon library. `assets/brand/mark.svg` is the one authored icon.',
    'The terminal draws glyphs: `│ ├ ✓ ! ✗ + - ◆ ◇ ❯`.',
  ],
}

/** A role's value, or `undefined` where the record declares no such role. */
export function colorValue(
  role: string,
  tokens: DesignTokens = TOKENS,
): string | undefined {
  return tokens.color.find((token) => token.role === role)?.value
}
