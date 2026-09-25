/**
 * The design system's one source of values.
 *
 * `canon/DESIGN.md` is rendered from this module rather than read by it, so
 * the document a person opens is a view and this file is the fact. Every
 * rendering surface reads from here in the form it can take: a CSS surface
 * takes custom properties through `@/design/css`, and the slide renderer takes
 * bare hex through `bareHex` below, because PowerPoint has no concept of a
 * custom property.
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

export interface DesignTokens {
  readonly personality: string
  readonly color: readonly ColorToken[]
  readonly colorNote: string
  readonly typeScale: readonly TypeStep[]
  readonly typography: readonly TypeToken[]
  readonly typographyNote: string
  readonly spacing: readonly SpaceToken[]
  readonly spacingNote: string
  readonly borders: readonly BorderToken[]
  readonly bordersNote: string
  readonly layout: string
  readonly motion: string
  readonly iconography: string
  readonly preamble: string
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
  preamble: [
    'This document is rendered from `src/design/tokens.ts` by `canon design regen`, and the `design` stage of `bun run check` fails when the two disagree. Edit the module, never this file.',
    '',
    'The values below are the system rather than a reading of one. Until 2026-09-01 this record transcribed two surfaces and agreed with nothing else, which is what made a change to it reach nobody. The slide theme, the token preview, and a teach workspace stylesheet now read the module this file is rendered from, so a value changed there changes what all three render.',
    '',
    'The two rendered captures read it as well. `scripts/core/regen-hero.sh` fills `assets/captures/hero.html.tmpl` and `assets/captures/install.html.tmpl` with what `canon design css --no-components` emits, so both frames now carry the custom properties rather than their own copies of the hex, and a value moved here moves what the next capture renders.',
    '',
    'The terminal framing is the one surface left holding its own values, and that is a decision rather than a gap. `scripts/lib/ui.sh` and `src/ui.ts` each spell six escape constants, and `canon/context/scripts/framing.md` records one color source per language with a check behind each, so generating a third spelling from here would break the rule those two checks enforce. What the record is still incomplete about is the other half of those six: `WHITE` and `GREY` name no role below, so the terminal palette is described here in part rather than in whole.',
  ].join('\n'),

  personality: [
    'Warm neutrals carry the frame under a single rust accent, set in Geist. The subject is a toolkit for people who read documents and diffs as much as they run commands, so the voice is a proportional one and the page reads as prose. One accent carries every count, link, and primary action. Promoting a second and third into structural roles is what reads as a generated interface, so the palette stays at one.',
    '',
    'Monospace is a role the page uses rather than its voice. The `code` role takes it, and so does any terminal frame a surface embeds, since those show what the shell printed and matching the shell is what makes them legible. Every other role is Geist.',
  ].join('\n'),

  colorNote: [
    'Every role clears WCAG AA at 4.5:1 against each ground it declares, asserted in `src/design/contrast.test.ts`.',
    '',
    'Warning and error hold ANSI codes because that is what `scripts/lib/ui.sh` writes and no rendered surface implements an equivalent. Giving either a hex value would invent a mapping no file has, so they carry no contrast reading either.',
    '',
    'Success is the one of the three that does have a rendered equivalent, which is why it carries a hex. `assets/captures/install.html` marks every confirmed step with it, and the shell writes `ANSI 32` for the same role, so the two are one role in two registers rather than one value in two spellings. The hex is what the rendered surface picked and no reading claims the terminal renders that value. It declares `background` alone as its ground, since that is the only role it is drawn on, where every other dark text role is drawn on both. It is the one role below that is not derived.',
    '',
    "Every other role is derived rather than picked, solved in OKLCH by binary search for the lightness that hits a target contrast against its ground, using this module's own anchors. Six anchors are the whole system: ground lightness 0.985 light and 0.165 dark, neutral chroma 0.003 light and 0.004 dark, neutral hue 90 both, accent hue 22 light and 28 dark, accent chroma 0.13 light and 0.12 dark for a mark and 0.095 light and 0.09 dark for a fill. Only the mark step is rendered below, in `accent`. That token already stands in for a fill in practice: `assets/captures/hero.html`'s `.cmd` rule paints its whole background with `var(--color-accent)` and sets text on top, which is a fill use rather than a mark one. The fill chroma step has no token of its own yet, so a lower-saturation `accent-fill` would recolor that button rather than introduce a new consumer. Targets, which are inputs rather than results: text 13.5, body 8.6, secondary 5.6, muted 4.6, accent 5.2. Dark is its own anchor set rather than an inversion of light, and every arm measured in the groundwork behind this landed on identical neutral ratios, which is what made the accent choice a question about hue alone.",
    '',
    '`muted` and `light-muted` solve against `surface` rather than `background`. Both declare two grounds and the groundwork solved its target against one, so the recorded hex cleared 4.6 against `background` and read 4.40 dark, 4.24 light against `surface`, the tighter of the two since surface sits a step closer to its text color. The values here are re-solved for the same 4.6 target read against `surface` instead, which clears both: 4.58 dark, 4.56 light against `surface`, and 4.80 dark, 4.95 light against `background`.',
    '',
    'The accent is a quiet red at hue 22 light, 28 dark, chosen over a vivid red that read as an error state against a page reporting success, over indigo which carries less distinctiveness at hue 280 in tooling already dominated by that hue, and over rust at hue 42, a larger temperature shift than the problem required. The debt this accepts: `error` and `warning` now share a register with the most repeated element on every rendered surface, so both need differentiating by lightness or by an icon rather than by hue, and that work is unscheduled.',
  ].join('\n'),

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

  typographyNote: [
    'Seven sizes are on offer, named `t0` through `t6` and emitted as custom properties beside the roles. They are 3.175, 2.375, 1.375, 1.125, 0.9375, 0.8125 and 0.6875 rem, which paint at 50.8, 38, 22, 18, 15, 13 and 11 pixels, and each role takes one. A step answers what sizes exist and a role answers what a stylesheet asks for, so the two stay separate: a role whose step did not move renders as it did, and a role that moved is the only thing that changes what a surface paints. Two steps, `t3` at 18 pixels and `t6` at 11, are offered with no role pointing at them yet.',
    '',
    'Every role but `code` is Geist and `code` is monospace. The hero headline takes the largest step at 50.8 pixels, which no other role reaches, since a headline set at the display cap reads as an opening rather than as a section heading.',
    '',
    'A tagged cell is one no rendering surface exercises yet, which is a declaration the system has not tested rather than one it has.',
    '',
    'Two rules set tracking and no others touch it. The label role carries `0.05em`, and the display role tightens to `-0.01em`.',
  ].join('\n'),

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

  spacingNote: [
    'Seven steps run from a quarter rem to six, at 4, 8, 14, 24, 40, 64 and 96 pixels on a 16 pixel root. The scale is not a grid of one base, since the 14 between the 8 and the 24 is the step a control needs and no multiple of four supplies it, so the multiplier column counts quarter rems rather than claiming a unit.',
    '',
    'The outer window padding of the capture frames, which the previous record carried as a three-value frame register, is not part of the scale. Those frames set their own padding in the template and read no step, so the register is retired here rather than mapped onto steps no frame uses.',
  ].join('\n'),

  spacing: [
    { step: 'xs', multiplier: '1', value: '0.25rem' },
    { step: 'sm', multiplier: '2', value: '0.5rem' },
    { step: 'md', multiplier: '3.5', value: '0.875rem' },
    { step: 'lg', multiplier: '6', value: '1.5rem' },
    { step: 'xl', multiplier: '10', value: '2.5rem' },
    { step: '2xl', multiplier: '16', value: '4rem' },
    { step: '3xl', multiplier: '24', value: '6rem' },
  ],

  bordersNote: [
    'Every border is one pixel solid at the `border` role, and that value appears in no text role. Three radii appear, and the two blocks carrying the largest and smallest have no border at all, so radius and width are independent here rather than paired. Nothing renders a pill, so both of its cells stay tagged.',
  ].join('\n'),

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

  layout:
    'Capture widths are 320, 768, 1280 and 1536 pixels, declared once in `tooling/web/configs/e2e/screenshot.ts`, with 320 and 1280 committed as evidence. 320 is the reflow floor. Every range the width queries in the generated base and teach stylesheets lay out holds at least one of these widths, so a capture photographs every layout state those stylesheets have, and a design test fails when a query moves or is added so that it opens a range none of them reaches. The landing page under `web/` sets its own `max-width` media queries between 430 and 1100 pixels per component rather than from a shared scale.',

  motion:
    'Motion is not used. No transition, animation, or keyframe declaration appears on any rendered surface, and the capture pipeline screenshots a static frame.',

  iconography: [
    'No icon library is installed. `assets/brand/mark.svg` is the one authored icon, embedded inline in the hero topbar, and the surfaces otherwise draw literal glyph characters: `│ ├ ✓ ! ✗ + - ◆ ◇ ❯` for the terminal framing.',
    '',
    'The same mark ships in five independently-maintained copies that carry different colors by design rather than by drift, each fitted to the chrome it renders on: the dark accent for a dark-chrome surface, the light accent for a light-chrome one, and the pair the web favicon takes from `src/design/favicon.ts`, which teach pages also take by rendering the live mark. Unifying them or repairing the one that looks drifted would break the fit each was chosen for. `canon/context/design/tokens.md` carries which file holds each copy.',
  ].join('\n'),
}

/** A role's value, or `undefined` where the record declares no such role. */
export function colorValue(
  role: string,
  tokens: DesignTokens = TOKENS,
): string | undefined {
  return tokens.color.find((token) => token.role === role)?.value
}

/**
 * The adapter the slide renderer takes. `PptxGenJS` receives color as
 * `{ color: theme.background }` and wants six hex digits with no leading `#`,
 * so the shared thing is the value and this is the per-consumer form.
 *
 * The hex is raised to upper case because that is the spelling
 * `src/slides/styles.ts` has always written, and the only one a diff of a
 * rendered deck reads cleanly against.
 */
export function bareHex(value: string): string {
  return value.replace(/^#/, '').toUpperCase()
}
