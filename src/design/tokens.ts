/**
 * The design system's one source of values. `canon/DESIGN.md` and the CSS
 * from `@/design/css` are views of it, and only the `design` gate stage
 * compares them.
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
 * Stops at two names and a generic so its `web/src/styles/tokens.css` line
 * stays under 80 columns, where oxfmt and `bun run web:tokens` disagree.
 */
const SANS = 'Geist Variable, DejaVu Sans, sans-serif'

const DARK_GROUNDS = ['background', 'surface', 'window'] as const
const LIGHT_GROUNDS = [
  'light-background',
  'light-surface',
  'light-window',
] as const

/** The day the record was last read whole, rendered into its frontmatter so `canon design regen` and the review point agree. */
export const REVIEWED = '2026-11-18'

export const TOKENS: DesignTokens = {
  personality:
    'A drawn system: a warm neutral ground ruled in a 48px grid, ink text in Geist, and Geist Mono for a path, a command, or shell output. Cards take an ink outline and a hard offset shadow. The vermilion pip of the mark is the one accent, marking a status.',

  colorRules: [
    "One accent, the mark's pip, and no second color in a structural role. A theme-fixed surface reads the `--color-dark-*` or `--color-light-*` family.",
    'Every text role clears WCAG AA at 4.5:1 against each ground it is drawn on.',
    '`waiting` colors product-view glyphs, never text. `warning` and `error` exist only in the terminal, as ANSI codes.',
  ],

  color: [
    {
      role: 'background',
      intent: 'page canvas',
      value: '#1e1e1c',
    },
    {
      role: 'surface',
      intent: 'a drawn card, a stamp, or a control',
      value: '#292927',
    },
    {
      role: 'window',
      intent: 'the body of a product window',
      value: '#31312e',
    },
    {
      role: 'chrome',
      intent: 'the window titlebar',
      value: '#383835',
    },
    {
      role: 'band',
      intent: 'a quiet fill inside a window, such as a prompt',
      value: '#3d3d39',
    },
    {
      role: 'grid',
      intent: 'the lines the page ground rules every 48px',
      value: '#242421',
    },
    {
      role: 'rule',
      intent: 'the soft seam between sections, and under a scrolled nav',
      value: '#3d3d39',
    },
    {
      role: 'border',
      intent: 'every rule and divider inside a card',
      value: '#474742',
    },
    {
      role: 'outline',
      intent: 'the drawn border around a card, a control, or a stamp',
      value: '#8d8c86',
    },
    {
      role: 'edge',
      intent: "a control's outline",
      value: '#4d4d48',
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
      value: '#a9a7a0',
      grounds: [...DARK_GROUNDS, 'band'],
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
      intent: 'a drawn card, a stamp, or a control, on light',
      value: '#ffffff',
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
      role: 'light-grid',
      intent: 'the lines the page ground rules every 48px, on light',
      value: '#ececea',
    },
    {
      role: 'light-rule',
      intent:
        'the soft seam between sections, and under a scrolled nav, on light',
      value: '#d6d6d2',
    },
    {
      role: 'light-border',
      intent: 'rules and dividers inside a card, on light',
      value: '#ececea',
    },
    {
      role: 'light-outline',
      intent: 'the drawn border around a card, a control, or a stamp, on light',
      value: '#121212',
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
      grounds: [...LIGHT_GROUNDS, 'light-band'],
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
    'Eight steps: five on a 4:3 ratio from body 16, `label` for links and card titles, two in product windows. A role takes one.',
  ],

  typeScale: [
    { step: 'hero', size: '4.5rem', tablet: '3.375rem', phone: '2.5rem' },
    { step: 'display', size: '3.125rem', tablet: '2.5rem', phone: '2rem' },
    { step: 'lede', size: '1.3125rem', tablet: '1.125rem', phone: '1.0625rem' },
    { step: 'body', size: '1rem', phone: '0.9375rem' },
    { step: 'label', size: '0.875rem' },
    { step: 'small', size: '0.8125rem', phone: '0.78125rem' },
    { step: 'view', size: '0.8125rem', phone: '0.75rem' },
    { step: 'view-small', size: '0.75rem', tablet: '0.6875rem' },
  ],

  typography: [
    {
      role: 'hero',
      family: SANS,
      weight: '600',
      size: '4.5rem',
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
      role: 'label',
      family: SANS,
      weight: '600',
      size: '0.875rem',
      lineHeight: '1.3',
      step: 'label',
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
    'A drawn surface takes a 1.5px `outline` border and an offset shadow. Inside one, a rule is 1px `border`. A section seam is 1px `rule`.',
    'Radius and width are independent.',
    'No pill. A one-line picker takes `action` at 28px high.',
  ],

  borders: [
    {
      role: 'card',
      radius: '10px',
      width: '1.5px',
      when: 'a drawn card, a stamp, or the terminal',
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
      when: 'the soft seam between sections',
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
      role: 'offset',
      value: '5px 5px 0 #5c5b56',
      when: 'a drawn card, dropped down and right',
    },
    {
      role: 'offset-small',
      value: '3px 3px 0 #5c5b56',
      when: 'a drawn control or a small card',
    },
    {
      role: 'offset-raised',
      value: '8px 8px 0 #5c5b56',
      when: 'the card brought to the front of a stack',
    },
    {
      role: 'window',
      value:
        '0 0 0 1px rgba(255, 255, 255, 0.06), 0 24px 60px -28px rgba(0, 0, 0, 0.6)',
      when: 'a Claude Code window set on the page',
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
      role: 'light-offset',
      value: '5px 5px 0 #121212',
      when: 'a drawn card, on light',
    },
    {
      role: 'light-offset-small',
      value: '3px 3px 0 #121212',
      when: 'a drawn control or a small card, on light',
    },
    {
      role: 'light-offset-raised',
      value: '8px 8px 0 #121212',
      when: 'the card brought to the front of a stack, on light',
    },
    {
      role: 'light-window',
      value:
        '0 0 0 1px rgba(0, 0, 0, 0.07), 0 24px 60px -28px rgba(0, 0, 0, 0.3)',
      when: 'a Claude Code window set on the page, on light',
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
