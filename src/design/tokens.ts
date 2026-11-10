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
  /** The `typeScale` step the role takes, read for its tablet and phone sizes. */
  readonly step?: string
  readonly verify?: readonly ('family' | 'weight' | 'size' | 'lineHeight')[]
}

/**
 * One size the system offers, named apart from any role that takes it. A step
 * names its tablet and phone sizes where it shrinks, which `@/design/css` emits
 * under the `TABLET` and `PHONE` queries.
 */
export interface TypeStep {
  readonly step: string
  readonly size: string
  readonly tablet?: string
  readonly phone?: string
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
  /** A radius that steps down on smaller screens, as `TypeStep` sizes do. */
  readonly tablet?: string
  readonly phone?: string
  readonly verify?: readonly ('radius' | 'width')[]
}

/**
 * A shadow, a duration, or an easing curve. A shadow role prefixed `light-`
 * stands in for its unprefixed role on a light ground, as a color role does.
 */
export interface EffectToken {
  readonly role: string
  readonly value: string
  readonly when: string
}

/**
 * Every prose slot is a list of one-line rules rather than a string, so a
 * bullet is the unit the renderer emits and the prose budget counts, and a
 * value needing a paragraph of why goes to `canon/context/features/design.md`.
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
  readonly shadows: readonly EffectToken[]
  readonly motion: readonly string[]
  readonly durations: readonly EffectToken[]
  readonly easings: readonly EffectToken[]
  readonly iconography: readonly string[]
}

/** The monospace stack, taken by code, by product-view text, and by the terminal frames a page embeds. */
const MONO = 'Geist Mono Variable, DejaVu Sans Mono, monospace'

/**
 * The proportional stack every role but `code` and `view` declares. Geist is
 * the face the visual-direction track set throughout, embedded through
 * `FONT_FACES`.
 *
 * The stack stops at two names and a generic because
 * `web/src/styles/tokens.css` is written by `bun run web:tokens` and formatted
 * by oxfmt, and a declaration
 * past 80 columns is wrapped by the second and flattened by the first. Every
 * emitted line stays inside the width so the two writers never disagree.
 */
const SANS = 'Geist Variable, DejaVu Sans, sans-serif'

const DARK_GROUNDS = ['background', 'surface', 'window'] as const
const LIGHT_GROUNDS = [
  'light-background',
  'light-surface',
  'light-window',
] as const

/** The day the record was last read whole, rendered into its frontmatter so `canon design regen` and the review point agree. */
export const REVIEWED = '2026-11-10'

export const TOKENS: DesignTokens = {
  personality:
    'Warm neutral grounds with ink text, set in Geist, and Geist Mono where a surface shows a path, a command, or what a shell printed. Product windows sit on a soft tray. The vermilion pip of the mark is the one accent, marking a status the surface would color.',

  colorRules: [
    "One accent, the mark's pip. Never promote a second color into a structural role.",
    'Every text role clears WCAG AA at 4.5:1 against each ground it is drawn on.',
    '`waiting` colors product-view glyphs, never text. `warning` and `error` exist only in the terminal, as ANSI codes.',
  ],

  color: [
    {
      role: 'background',
      intent: 'page canvas',
      value: '#121211',
    },
    {
      role: 'surface',
      intent: 'the tray a product window sits in, and cards',
      value: '#1a1a18',
    },
    {
      role: 'window',
      intent: 'the body of a product window',
      value: '#1e1e1e',
    },
    {
      role: 'chrome',
      intent: 'the window titlebar',
      value: '#252523',
    },
    {
      role: 'band',
      intent: 'a quiet fill inside a window, such as a prompt',
      value: '#282826',
    },
    {
      role: 'border',
      intent: 'every rule and divider',
      value: '#2e2e2c',
    },
    {
      role: 'edge',
      intent: "a control's outline",
      value: '#2a2a28',
    },
    {
      role: 'text',
      intent: 'headings, counts, emphasized runs',
      value: '#f2f2f0',
      grounds: DARK_GROUNDS,
    },
    {
      role: 'text-body',
      intent: 'default body copy',
      value: '#cfcdc8',
      grounds: DARK_GROUNDS,
    },
    {
      role: 'muted',
      intent: 'ledes, labels, captions, trailing notes',
      value: '#8f8d88',
      grounds: DARK_GROUNDS,
    },
    {
      role: 'accent',
      intent: 'the pip, and a status the surface would color',
      value: '#ff6b42',
      grounds: DARK_GROUNDS,
    },
    {
      role: 'success',
      intent: 'done, rendered and in the terminal',
      value: '#6fae6a',
      grounds: ['background', 'window'],
    },
    {
      role: 'waiting',
      intent: 'a product-view glyph for work not yet done',
      value: '#e5b567',
    },
    { role: 'warning', intent: 'terminal cautions', value: 'ANSI 33' },
    { role: 'error', intent: 'terminal failures', value: 'ANSI 31' },
    {
      role: 'light-background',
      intent: 'page canvas on a light ground',
      value: '#fdfdfc',
    },
    {
      role: 'light-surface',
      intent: 'the tray and cards on a light ground',
      value: '#f2f2f0',
    },
    {
      role: 'light-window',
      intent: 'the body of a product window on light',
      value: '#ffffff',
    },
    {
      role: 'light-chrome',
      intent: 'the window titlebar on light',
      value: '#f7f7f5',
    },
    {
      role: 'light-band',
      intent: 'a quiet fill inside a window, on light',
      value: '#f0f0ee',
    },
    {
      role: 'light-border',
      intent: 'rules and dividers on light',
      value: '#ececea',
    },
    {
      role: 'light-edge',
      intent: "a control's outline, on light",
      value: '#e4e4e1',
    },
    {
      role: 'light-text',
      intent: 'primary text on a light ground',
      value: '#121212',
      grounds: LIGHT_GROUNDS,
    },
    {
      role: 'light-text-body',
      intent: 'default body copy on a light ground',
      value: '#3b3b38',
      grounds: LIGHT_GROUNDS,
    },
    {
      role: 'light-muted',
      intent: 'ledes, labels, and captions on a light ground',
      value: '#6b6a66',
      grounds: LIGHT_GROUNDS,
    },
    {
      role: 'light-accent',
      intent: 'the pip, and a status the surface would color, on light',
      value: '#c2380e',
      grounds: LIGHT_GROUNDS,
    },
    {
      role: 'light-success',
      intent: 'done, rendered and in the terminal, on light',
      value: '#3f7f3e',
      grounds: ['light-background', 'light-window'],
    },
    {
      role: 'light-waiting',
      intent: 'a product-view glyph for work not yet done, on light',
      value: '#b07d1a',
    },
  ],

  typographyRules: [
    'Geist for every role except `code` and `view`, which take Geist Mono.',
    'Tracking: `hero` at `-0.04em`, `display` at `-0.03em`, nothing else.',
    'Seven steps, five on a 4:3 ratio from body 16 and two inside product windows. A role takes one step.',
  ],

  typeScale: [
    { step: 'hero', size: '5.625rem', tablet: '4rem', phone: '2.5rem' },
    { step: 'display', size: '3.125rem', tablet: '2.5rem', phone: '2rem' },
    { step: 'lede', size: '1.3125rem', tablet: '1.125rem', phone: '1.0625rem' },
    { step: 'body', size: '1rem', phone: '0.9375rem' },
    { step: 'small', size: '0.8125rem', phone: '0.78125rem' },
    { step: 'view', size: '0.8125rem', phone: '0.75rem' },
    { step: 'view-small', size: '0.75rem', tablet: '0.6875rem' },
  ],

  typography: [
    {
      role: 'hero',
      family: SANS,
      weight: '600',
      size: '5.625rem',
      lineHeight: '1',
      step: 'hero',
    },
    {
      role: 'display',
      family: SANS,
      weight: '600',
      size: '3.125rem',
      lineHeight: '1.06',
      step: 'display',
    },
    {
      role: 'lede',
      family: SANS,
      weight: '400',
      size: '1.3125rem',
      lineHeight: '1.48',
      step: 'lede',
    },
    {
      role: 'title',
      family: SANS,
      weight: '600',
      size: '1rem',
      lineHeight: '1.55',
      step: 'body',
    },
    {
      role: 'body',
      family: SANS,
      weight: '400',
      size: '1rem',
      lineHeight: '1.55',
      step: 'body',
    },
    {
      role: 'small',
      family: SANS,
      weight: '500',
      size: '0.8125rem',
      lineHeight: '1.45',
      step: 'small',
    },
    {
      role: 'view',
      family: MONO,
      weight: '400',
      size: '0.8125rem',
      lineHeight: '1.6',
      step: 'view',
    },
    {
      role: 'view-small',
      family: SANS,
      weight: '500',
      size: '0.75rem',
      lineHeight: '1.45',
      step: 'view-small',
    },
    {
      role: 'code',
      family: MONO,
      weight: '400',
      size: '0.8125rem',
      lineHeight: '1.45',
      step: 'small',
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
    'Every border is one pixel solid, in `border` for a rule and `edge` around a control. Radius and width are independent.',
    'The tray steps down to 28px under 900 and 22px under 640.',
    'No pill. A one-line picker takes `action` at 28px high.',
  ],

  borders: [
    {
      role: 'tray',
      radius: '36px',
      width: 'none',
      when: 'the soft tray a product window sits in',
      tablet: '28px',
      phone: '22px',
    },
    {
      role: 'frame',
      radius: '12px',
      width: 'none',
      when: 'windows, sheets, popovers, a picked or hovered row',
    },
    {
      role: 'panel',
      radius: '12px',
      width: '1px',
      when: 'cards and columns',
    },
    {
      role: 'action',
      radius: '8px',
      width: 'none',
      when: 'controls, the install command, one-line pickers',
    },
    {
      role: 'chip',
      radius: '4px',
      width: 'none',
      when: 'chips and tags',
    },
    {
      role: 'rule',
      radius: 'none',
      width: '1px',
      when: 'horizontal dividers between bands',
    },
    {
      role: 'marker',
      radius: '2px',
      width: 'none',
      when: 'status marks and the status dot, sized at 6px',
    },
  ],

  layout: [
    'Capture widths: 320, 768, 1280, 1536. 320 is the reflow floor.',
    'Every width query in the generated stylesheets opens a range one of these widths reaches.',
    'Draw widths: 390, 834, 1440. Every pick is also checked for sideways scroll at 320.',
  ],

  shadows: [
    {
      role: 'window',
      value:
        '0 0 0 1px rgba(255, 255, 255, 0.06), 0 24px 60px -28px rgba(0, 0, 0, 0.6)',
      when: 'a product window on its tray',
    },
    {
      role: 'popover',
      value:
        '0 0 0 1px rgba(255, 255, 255, 0.06), 0 16px 36px -16px rgba(0, 0, 0, 0.6)',
      when: 'a menu or popover over content',
    },
    {
      role: 'ring',
      value: '0 0 0 1px rgba(255, 255, 255, 0.06)',
      when: 'a hairline around a picked row',
    },
    {
      role: 'light-window',
      value:
        '0 0 0 1px rgba(0, 0, 0, 0.07), 0 24px 60px -28px rgba(0, 0, 0, 0.3)',
      when: 'a product window on its tray, on light',
    },
    {
      role: 'light-popover',
      value:
        '0 0 0 1px rgba(0, 0, 0, 0.07), 0 16px 36px -16px rgba(0, 0, 0, 0.3)',
      when: 'a menu or popover over content, on light',
    },
    {
      role: 'light-ring',
      value: '0 0 0 1px rgba(0, 0, 0, 0.07)',
      when: 'a hairline around a picked row, on light',
    },
  ],

  durations: [
    { role: 'feedback', value: '120ms', when: 'hover, press, and toggle' },
    { role: 'fade', value: '240ms', when: 'a fade in or out' },
    { role: 'move', value: '400ms', when: 'an element moving or resizing' },
    { role: 'draw', value: '1000ms', when: 'a line or figure drawing on' },
  ],

  easings: [
    {
      role: 'standard',
      value: 'cubic-bezier(0.3, 0.7, 0.3, 1)',
      when: 'fades and moves',
    },
    {
      role: 'draw',
      value: 'cubic-bezier(0.65, 0, 0.35, 1)',
      when: 'draws',
    },
  ],

  motion: [
    'Four durations and two curves. Progress runs linear, and nothing sets a timing of its own.',
    "Product-view loops keep Claude Code's rhythm: a 1.6s spinner, a 1.4s pulse, a 1.1s cursor blink.",
    'Under reduced motion every end state renders at once, so a duration is never the only way to reach one.',
  ],

  iconography: [
    'No icon library. `assets/brand/mark.svg` is the one authored icon.',
    'The mark takes its colors from `src/design/favicon.ts`: the c in the text ink and the pip in the accent pair.',
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
