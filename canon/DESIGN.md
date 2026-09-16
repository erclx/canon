# Design

Authoring guidance: `standards/design.md`.

This document is rendered from `src/design/tokens.ts` by `canon design regen`, and the `design` stage of `bun run check` fails when the two disagree. Edit the module, never this file.

The values below are the system rather than a reading of one. Until 2026-09-01 this record transcribed two surfaces and agreed with nothing else, which is what made a change to it reach nobody. The slide theme, the token preview, and a teach workspace stylesheet now read the module this file is rendered from, so a value changed there changes what all three render.

The two rendered captures read it as well. `scripts/core/regen-hero.sh` fills `assets/captures/hero.html.tmpl` and `assets/captures/install.html.tmpl` with what `canon design css --no-components` emits, so both frames now carry the custom properties rather than their own copies of the hex, and a value moved here moves what the next capture renders.

The terminal framing is the one surface left holding its own values, and that is a decision rather than a gap. `scripts/lib/ui.sh` and `src/ui.ts` each spell six escape constants, and `canon/ARCHITECTURE.md` records one color source per language with a check behind each, so generating a third spelling from here would break the rule those two checks enforce. What the record is still incomplete about is the other half of those six: `WHITE` and `GREY` name no role below, so the terminal palette is described here in part rather than in whole.

## Personality

Warm neutrals carry the frame under a single rust accent, rendered in the same monospace the terminal uses. The subject picks the register rather than taste: a toolkit whose primary surface is a shell has no proportional voice available, so the rendered surfaces match the terminal instead of the reverse. One accent carries every count, link, and primary action. Promoting a second and third into structural roles is what reads as a generated interface, so the palette stays at one.

One surface is carved out of the sentence above, and it is the landing page hero. A rendered surface here shows a reader what the terminal did, so matching the terminal is what makes it legible. A public page addresses somebody who has never opened the terminal at all, and the shell has no voice available for that, which is the reverse of the case the rule was written for. The `page-display` role below is the whole of the carve-out. Every other role on that page stays monospace, including its body, its controls, and every frame it embeds, so the page reads as two families rather than as a second design system.

## Color

Every role clears WCAG AA at 4.5:1 against each ground it declares, asserted in `src/design/contrast.test.ts`.

Warning and error hold ANSI codes because that is what `scripts/lib/ui.sh` writes and no rendered surface implements an equivalent. Giving either a hex value would invent a mapping no file has, so they carry no contrast reading either.

Success is the one of the three that does have a rendered equivalent, which is why it carries a hex. `assets/captures/install.html` marks every confirmed step with it, and the shell writes `ANSI 32` for the same role, so the two are one role in two registers rather than one value in two spellings. The hex is what the rendered surface picked and no reading claims the terminal renders that value. It declares `background` alone as its ground, since that is the only role it is drawn on, where every other dark text role is drawn on both. It is the one role below that is not derived.

Every other role is derived rather than picked, solved in OKLCH by binary search for the lightness that hits a target contrast against its ground, using this module's own anchors. Six anchors are the whole system: ground lightness 0.985 light and 0.165 dark, neutral chroma 0.003 light and 0.004 dark, neutral hue 90 both, accent hue 22 light and 28 dark, accent chroma 0.13 light and 0.12 dark for a mark and 0.095 light and 0.09 dark for a fill. Only the mark step is rendered below, in `accent`, since nothing in this tree yet consumes a fill role. Targets, which are inputs rather than results: text 13.5, body 8.6, secondary 5.6, muted 4.6, accent 5.2. Dark is its own anchor set rather than an inversion of light, and every arm measured in the groundwork behind this landed on identical neutral ratios, which is what made the accent choice a question about hue alone.

`muted` and `light-muted` solve against `surface` rather than `background`. Both declare two grounds and the groundwork solved its target against one, so the recorded hex cleared 4.6 against `background` and read 4.40 dark, 4.24 light against `surface`, the tighter of the two since surface sits a step closer to its text color. The values here are re-solved for the same 4.6 target read against `surface` instead, which clears both: 4.58 dark, 4.56 light against `surface`, and 4.80 dark, 4.95 light against `background`.

The accent is a quiet red at hue 22 light, 28 dark, chosen over a vivid red that read as an error state against a page reporting success, over indigo which carries less distinctiveness at hue 280 in tooling already dominated by that hue, and over rust at hue 42, a larger temperature shift than the problem required. The debt this accepts: `error` and `warning` now share a register with the most repeated element on every rendered surface, so both need differentiating by lightness or by an icon rather than by hue, and that work is unscheduled.

| Role                 | Intent                                                | Value            |
| -------------------- | ----------------------------------------------------- | ---------------- |
| background           | page canvas                                           | #0f0e0c          |
| surface              | cards, panels, raised blocks                          | #151412          |
| chrome               | the window titlebar, one step above the canvas        | #1b1a18          |
| border               | every rule and panel edge                             | #2a2926          |
| text                 | headings, counts, emphasized runs                     | #d9d7d4          |
| text-body            | default body copy                                     | #aeada9          |
| text-secondary       | labels, captions, supporting copy                     | #8c8b86          |
| muted                | the faintest step, trailing notes                     | #7f7f7c          |
| accent               | install command, mark, primary action                 | #c76b5f          |
| success              | confirmations, rendered and in the terminal           | #61c454          |
| warning              | terminal cautions                                     | ANSI 33          |
| error                | terminal failures                                     | ANSI 31          |
| light-background     | page canvas on a light ground                         | #fbfaf8          |
| light-surface        | cards and panels on a light ground                    | #f1f1ee          |
| light-chrome         | the window titlebar, one step above the canvas        | #e9e8e5          |
| light-text           | primary text on a light ground                        | #2c2c29          |
| light-text-body      | default body copy on a light ground                   | #4b4947          |
| light-text-secondary | labels, captions, supporting copy on a light ground   | #666561          |
| light-muted          | secondary text on a light ground                      | #6e6d6c          |
| light-accent         | links and primary action on light                     | #ad4a4b          |
| light-success        | confirmations, rendered and in the terminal, on light | #2d6b22          |
| light-border         | rules and panel edges on light                        | #d5d4d1 ? verify |

## Typography

One family covers every role but `page-display`, which is the landing page hero and takes the proportional sibling of the same superfamily. The size scale runs from 11.5 to 52 pixels, and six values map onto a role. Five further values are adjustments inside a single component and get no role here, since a scale with five invented steps reads as a system the surfaces do not implement. They are 11.5, 12.5, 13, 14, and 15 pixels.

The 52 pixel step sits above the 34 the rest of the scale tops out at, and it is the one size no other surface reaches, since a hero headline set at the display cap reads as an opening rather than as a section heading.

A tagged cell is one no rendering surface exercises yet, which is a declaration the system has not tested rather than one it has.

Two rules set tracking and no others touch it. The label role carries `0.05em`, and the display role tightens to `-0.01em`.

| Role         | Family                                      | Weight       | Size          | Line height   |
| ------------ | ------------------------------------------- | ------------ | ------------- | ------------- |
| display      | Noto Sans Mono, DejaVu Sans Mono, monospace | 700          | 34px          | 1.3           |
| page-display | Noto Sans, DejaVu Sans, sans-serif ? verify | 700          | 52px ? verify | 1.1 ? verify  |
| heading      | Noto Sans Mono, DejaVu Sans Mono, monospace | 700          | 19px          | 1.3 ? verify  |
| body         | Noto Sans Mono, DejaVu Sans Mono, monospace | 400 ? verify | 16px          | 1.65          |
| label        | Noto Sans Mono, DejaVu Sans Mono, monospace | 400 ? verify | 12px          | 1.45 ? verify |
| code         | Noto Sans Mono, DejaVu Sans Mono, monospace | 700          | 14.5px        | 1.3 ? verify  |

## Spacing

The base is six pixels, which is the largest unit dividing the values that recur: 6, 12, 18, 24, and 30. One-off paddings at 9, 10, 11, 13, 14, 16, 22, 26, 34, and 40 pixels sit off the scale entirely and get no step.

The outer window padding is a single declaration reading `44px 52px 38px`, and none of its three values divides by six. They carry no multiplier for that reason, and one declaration setting all three is the only thing grouping them, so they are a frame register rather than a scale.

| Step         | Multiplier | Value |
| ------------ | ---------- | ----- |
| xs           | 1          | 6px   |
| sm           | 2          | 12px  |
| md           | 3          | 18px  |
| lg           | 4          | 24px  |
| xl           | 5          | 30px  |
| frame-top    | none       | 44px  |
| frame-inline | none       | 52px  |
| frame-bottom | none       | 38px  |

## Borders

Every border is one pixel solid at the `border` role, and that value appears in no text role. Three radii appear, and the two blocks carrying the largest and smallest have no border at all, so radius and width are independent here rather than paired. Nothing renders a pill, so both of its cells stay tagged.

| Role   | Radius         | Width         | When used                         |
| ------ | -------------- | ------------- | --------------------------------- |
| frame  | 12px           | none          | the outer window, radius only     |
| panel  | 10px           | 1px           | cards and columns                 |
| action | 7px            | none          | the install command block         |
| rule   | none           | 1px           | horizontal dividers between bands |
| pill   | 999px ? verify | none ? verify | tags and status chips, none built |
| marker | 999px          | none          | the status dot, sized at 6px      |

## Motion

Motion is not used. No transition, animation, or keyframe declaration appears on any rendered surface, and the capture pipeline screenshots a static frame.

## Iconography

No icon library is installed. `assets/brand/mark.svg` is the one authored icon, embedded inline in the hero topbar, and the surfaces otherwise draw literal glyph characters: `│ ├ ✓ ! ✗ + - ◆ ◇ ❯` for the terminal framing.

The same mark ships as a favicon on every rendered surface, as three independently-maintained copies that track different accents by design rather than by drift, colored to fit the chrome each renders on: the dark accent (`#e0724b`) for a dark-chrome surface and the light accent (`#a4471c`) for a light-chrome one. Unifying the three or repairing the one that looks drifted would break the fit each was chosen for. `canon/context/design.md` carries which file holds each copy.
