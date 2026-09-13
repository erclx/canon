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
  readonly typography: readonly TypeToken[]
  readonly typographyNote: string
  readonly spacing: readonly SpaceToken[]
  readonly spacingNote: string
  readonly borders: readonly BorderToken[]
  readonly bordersNote: string
  readonly motion: string
  readonly iconography: string
  readonly preamble: string
}

/** The monospace stack every surface but the landing page hero declares. */
const MONO = 'Noto Sans Mono, DejaVu Sans Mono, monospace'

/**
 * The proportional stack the landing page hero declares and nothing else does.
 * Noto Sans is the proportional sibling of the mono above rather than a face
 * picked for taste, so the pairing is one superfamily rather than two systems.
 *
 * The stack stops at two names and a generic because `src/design/base.css` is
 * written by `canon design regen` and formatted by prettier, and a declaration
 * past 80 columns is wrapped by the second and flattened by the first. Every
 * emitted line stays inside the width so the two writers never disagree.
 */
const SANS = 'Noto Sans, DejaVu Sans, sans-serif'

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
    'The terminal framing is the one surface left holding its own values, and that is a decision rather than a gap. `scripts/lib/ui.sh` and `src/ui.ts` each spell six escape constants, and `canon/ARCHITECTURE.md` records one color source per language with a check behind each, so generating a third spelling from here would break the rule those two checks enforce. What the record is still incomplete about is the other half of those six: `WHITE` and `GREY` name no role below, so the terminal palette is described here in part rather than in whole.',
  ].join('\n'),

  personality: [
    'Warm neutrals carry the frame under a single rust accent, rendered in the same monospace the terminal uses. The subject picks the register rather than taste: a toolkit whose primary surface is a shell has no proportional voice available, so the rendered surfaces match the terminal instead of the reverse. One accent carries every count, link, and primary action. Promoting a second and third into structural roles is what reads as a generated interface, so the palette stays at one.',
    '',
    'One surface is carved out of the sentence above, and it is the landing page hero. A rendered surface here shows a reader what the terminal did, so matching the terminal is what makes it legible. A public page addresses somebody who has never opened the terminal at all, and the shell has no voice available for that, which is the reverse of the case the rule was written for. The `page-display` role below is the whole of the carve-out. Every other role on that page stays monospace, including its body, its controls, and every frame it embeds, so the page reads as two families rather than as a second design system.',
  ].join('\n'),

  colorNote: [
    'Every role clears WCAG AA at 4.5:1 against each ground it declares, asserted in `src/design/contrast.test.ts`. Two corrections landed with this record becoming the source. The light `muted` step moved from `#7A736A`, which read 4.38 and 4.09 against the two light grounds, and the dark `accent` moved off the `#C8602E` the slide theme carried, which read 4.36 and 3.99 against the two dark ones. Both now sit on the values below.',
    '',
    'Warning and error hold ANSI codes because that is what `scripts/lib/ui.sh` writes and no rendered surface implements an equivalent. Giving either a hex value would invent a mapping no file has, so they carry no contrast reading either.',
    '',
    'Success is the one of the three that does have a rendered equivalent, which is why it carries a hex. `assets/captures/install.html` marks every confirmed step with it, and the shell writes `ANSI 32` for the same role, so the two are one role in two registers rather than one value in two spellings. The hex is what the rendered surface picked and no reading claims the terminal renders that value. It declares `background` alone as its ground, since that is the only role it is drawn on, where every other dark text role is drawn on both.',
  ].join('\n'),

  color: [
    {
      role: 'background',
      intent: 'page canvas',
      value: '#191512',
    },
    {
      role: 'surface',
      intent: 'cards, panels, raised blocks',
      value: '#211c19',
    },
    {
      role: 'chrome',
      intent: 'the window titlebar, one step above the canvas',
      value: '#241e1a',
    },
    {
      role: 'border',
      intent: 'every rule and panel edge',
      value: '#2f2823',
    },
    {
      role: 'text',
      intent: 'headings, counts, emphasized runs',
      value: '#f4efe9',
      grounds: DARK_GROUNDS,
    },
    {
      role: 'text-body',
      intent: 'default body copy',
      value: '#c9c0b7',
      grounds: DARK_GROUNDS,
    },
    {
      role: 'text-secondary',
      intent: 'labels, captions, supporting copy',
      value: '#a79d94',
      grounds: DARK_GROUNDS,
    },
    {
      role: 'muted',
      intent: 'the faintest step, trailing notes',
      value: '#948a81',
      grounds: DARK_GROUNDS,
    },
    {
      role: 'accent',
      intent: 'install command, mark, primary action',
      value: '#e0724b',
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
      value: '#faf7f2',
    },
    {
      role: 'light-surface',
      intent: 'cards and panels on a light ground',
      value: '#f4efe6',
    },
    {
      role: 'light-chrome',
      intent: 'the window titlebar, one step above the canvas',
      value: '#ede4d6',
    },
    {
      role: 'light-text',
      intent: 'primary text on a light ground',
      value: '#1a1815',
      grounds: LIGHT_GROUNDS,
    },
    {
      role: 'light-text-body',
      intent: 'default body copy on a light ground',
      value: '#3d3630',
      grounds: LIGHT_GROUNDS,
    },
    {
      role: 'light-text-secondary',
      intent: 'labels, captions, supporting copy on a light ground',
      value: '#5c544b',
      grounds: LIGHT_GROUNDS,
    },
    {
      role: 'light-muted',
      intent: 'secondary text on a light ground',
      value: '#726b62',
      grounds: LIGHT_GROUNDS,
    },
    {
      role: 'light-accent',
      intent: 'links and primary action on light',
      value: '#a4471c',
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
      value: '#e4dcd0',
      verify: true,
    },
  ],

  typographyNote: [
    'One family covers every role but `page-display`, which is the landing page hero and takes the proportional sibling of the same superfamily. The size scale runs from 11.5 to 52 pixels, and six values map onto a role. Five further values are adjustments inside a single component and get no role here, since a scale with five invented steps reads as a system the surfaces do not implement. They are 11.5, 12.5, 13, 14, and 15 pixels.',
    '',
    'The 52 pixel step sits above the 34 the rest of the scale tops out at, and it is the one size no other surface reaches. A hero headline set at the display cap reads as a section heading rather than an opening, which four rendered arms measured on 2026-09-04 before the step was added.',
    '',
    'A tagged cell is one no rendering surface exercises yet, which is a declaration the system has not tested rather than one it has.',
    '',
    'Two rules set tracking and no others touch it. The label role carries `0.05em`, and the display role tightens to `-0.01em`.',
  ].join('\n'),

  typography: [
    {
      role: 'display',
      family: MONO,
      weight: '700',
      size: '34px',
      lineHeight: '1.3',
    },
    {
      role: 'page-display',
      family: SANS,
      weight: '700',
      size: '52px',
      lineHeight: '1.1',
      verify: ['family', 'size', 'lineHeight'],
    },
    {
      role: 'heading',
      family: MONO,
      weight: '700',
      size: '19px',
      lineHeight: '1.3',
      verify: ['lineHeight'],
    },
    {
      role: 'body',
      family: MONO,
      weight: '400',
      size: '16px',
      lineHeight: '1.65',
      verify: ['weight'],
    },
    {
      role: 'label',
      family: MONO,
      weight: '400',
      size: '12px',
      lineHeight: '1.45',
      verify: ['weight', 'lineHeight'],
    },
    {
      role: 'code',
      family: MONO,
      weight: '700',
      size: '14.5px',
      lineHeight: '1.3',
      verify: ['lineHeight'],
    },
  ],

  spacingNote: [
    'The base is six pixels, which is the largest unit dividing the values that recur: 6, 12, 18, 24, and 30. One-off paddings at 9, 10, 11, 13, 14, 16, 22, 26, 34, and 40 pixels sit off the scale entirely and get no step.',
    '',
    'The outer window padding is a single declaration reading `44px 52px 38px`, and none of its three values divides by six. They carry no multiplier for that reason, and one declaration setting all three is the only thing grouping them, so they are a frame register rather than a scale.',
  ].join('\n'),

  spacing: [
    { step: 'xs', multiplier: '1', value: '6px' },
    { step: 'sm', multiplier: '2', value: '12px' },
    { step: 'md', multiplier: '3', value: '18px' },
    { step: 'lg', multiplier: '4', value: '24px' },
    { step: 'xl', multiplier: '5', value: '30px' },
    { step: 'frame-top', multiplier: 'none', value: '44px' },
    { step: 'frame-inline', multiplier: 'none', value: '52px' },
    { step: 'frame-bottom', multiplier: 'none', value: '38px' },
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

  motion:
    'Motion is not used. No transition, animation, or keyframe declaration appears on any rendered surface, and the capture pipeline screenshots a static frame.',

  iconography:
    "No icon library is installed. `assets/brand/mark.svg` is the one authored icon, embedded inline in the hero topbar, and the surfaces otherwise draw literal glyph characters: `│ ├ ✓ ! ✗ + - ◆ ◇ ❯` for the terminal framing. The same mark also ships as a favicon on every rendered surface, as three independently-maintained copies that track different accents by design rather than by drift: `regen-hero.sh` derives one from the live SVG colored with whatever `--color-accent` (`#e0724b`) the fetched token CSS carries, `src/design/render.ts` carries the path data as a hardcoded literal colored via `colorValue('light-accent')` (`#a4471c`), since a data URI has no CSS context and that page renders on light chrome, and `teach-workspace`'s `SKILL.md` names one in prose colored `rgb(224,114,75)`, the same value as the dark accent written as decimal rather than hex to clear the shipped-references gate's commit-sha check. Unifying the three or repairing the one that looks drifted would break the fit each was chosen for.",
}

/** A role's value, or `undefined` where the record declares no such role. */
export function colorValue(role: string): string | undefined {
  return TOKENS.color.find((token) => token.role === role)?.value
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
