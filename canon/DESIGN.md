# Design

Authoring guidance: `standards/design.md`.

This document is rendered from `src/design/tokens.ts` by `canon design regen`, and the `design` stage of `bun run check` fails when the two disagree. Edit the module, never this file.

The values below are the system rather than a reading of one. Until 2026-09-01 this record transcribed two surfaces and agreed with nothing else, which is what made a change to it reach nobody. The slide theme, the token preview, and a teach workspace stylesheet now read the module this file is rendered from, so a value changed there changes what all three render.

The two rendered captures read it as well. `scripts/core/regen-hero.sh` fills `assets/captures/hero.html.tmpl` and `assets/captures/install.html.tmpl` with what `canon design css --no-components` emits, so both frames now carry the custom properties rather than their own copies of the hex, and a value moved here moves what the next capture renders.

The terminal framing is the one surface left holding its own values, and that is a decision rather than a gap. `scripts/lib/ui.sh` and `src/ui.ts` each spell six escape constants, and `canon/context/scripts/framing.md` records one color source per language with a check behind each, so generating a third spelling from here would break the rule those two checks enforce. What the record is still incomplete about is the other half of those six: `WHITE` and `GREY` name no role below, so the terminal palette is described here in part rather than in whole.

## Personality

Warm neutrals carry the frame under a single rust accent, set in Geist. The subject is a toolkit for people who read documents and diffs as much as they run commands, so the voice is a proportional one and the page reads as prose. One accent carries every count, link, and primary action. Promoting a second and third into structural roles is what reads as a generated interface, so the palette stays at one.

Monospace is a role the page uses rather than its voice. The `code` role takes it, and so does any terminal frame a surface embeds, since those show what the shell printed and matching the shell is what makes them legible. Every other role is Geist.

## Color

Every role clears WCAG AA at 4.5:1 against each ground it declares, asserted in `src/design/contrast.test.ts`.

Warning and error hold ANSI codes because that is what `scripts/lib/ui.sh` writes and no rendered surface implements an equivalent. Giving either a hex value would invent a mapping no file has, so they carry no contrast reading either.

Success is the one of the three that does have a rendered equivalent, which is why it carries a hex. `assets/captures/install.html` marks every confirmed step with it, and the shell writes `ANSI 32` for the same role, so the two are one role in two registers rather than one value in two spellings. The hex is what the rendered surface picked and no reading claims the terminal renders that value. It declares `background` alone as its ground, since that is the only role it is drawn on, where every other dark text role is drawn on both. It is the one role below that is not derived.

Every other role is derived rather than picked, solved in OKLCH by binary search for the lightness that hits a target contrast against its ground, using this module's own anchors. Six anchors are the whole system: ground lightness 0.985 light and 0.165 dark, neutral chroma 0.003 light and 0.004 dark, neutral hue 90 both, accent hue 22 light and 28 dark, accent chroma 0.13 light and 0.12 dark for a mark and 0.095 light and 0.09 dark for a fill. Only the mark step is rendered below, in `accent`. That token already stands in for a fill in practice: `assets/captures/hero.html`'s `.cmd` rule paints its whole background with `var(--color-accent)` and sets text on top, which is a fill use rather than a mark one. The fill chroma step has no token of its own yet, so a lower-saturation `accent-fill` would recolor that button rather than introduce a new consumer. Targets, which are inputs rather than results: text 13.5, body 8.6, secondary 5.6, muted 4.6, accent 5.2. Dark is its own anchor set rather than an inversion of light, and every arm measured in the groundwork behind this landed on identical neutral ratios, which is what made the accent choice a question about hue alone.

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

Seven sizes are on offer, named `t0` through `t6` and emitted as custom properties beside the roles. They are 3.175, 2.375, 1.375, 1.125, 0.9375, 0.8125 and 0.6875 rem, which paint at 50.8, 38, 22, 18, 15, 13 and 11 pixels, and each role takes one. A step answers what sizes exist and a role answers what a stylesheet asks for, so the two stay separate: a role whose step did not move renders as it did, and a role that moved is the only thing that changes what a surface paints. Two steps, `t3` at 18 pixels and `t6` at 11, are offered with no role pointing at them yet.

Every role but `code` is Geist and `code` is monospace. The hero headline takes the largest step at 50.8 pixels, which no other role reaches, since a headline set at the display cap reads as an opening rather than as a section heading.

A tagged cell is one no rendering surface exercises yet, which is a declaration the system has not tested rather than one it has.

Two rules set tracking and no others touch it. The label role carries `0.05em`, and the display role tightens to `-0.01em`.

| Role         | Family                                      | Weight       | Size              | Line height   |
| ------------ | ------------------------------------------- | ------------ | ----------------- | ------------- |
| display      | Geist Variable, DejaVu Sans, sans-serif     | 700          | 2.375rem          | 1.3           |
| page-display | Geist Variable, DejaVu Sans, sans-serif     | 700          | 3.175rem ? verify | 1.1 ? verify  |
| heading      | Geist Variable, DejaVu Sans, sans-serif     | 700          | 1.375rem          | 1.3 ? verify  |
| body         | Geist Variable, DejaVu Sans, sans-serif     | 400 ? verify | 0.9375rem         | 1.65          |
| label        | Geist Variable, DejaVu Sans, sans-serif     | 400 ? verify | 0.8125rem         | 1.45 ? verify |
| code         | Noto Sans Mono, DejaVu Sans Mono, monospace | 700          | 0.8125rem         | 1.3 ? verify  |

## Spacing

Seven steps run from a quarter rem to six, at 4, 8, 14, 24, 40, 64 and 96 pixels on a 16 pixel root. The scale is not a grid of one base, since the 14 between the 8 and the 24 is the step a control needs and no multiple of four supplies it, so the multiplier column counts quarter rems rather than claiming a unit.

The outer window padding of the capture frames, which the previous record carried as a three-value frame register, is not part of the scale. Those frames set their own padding in the template and read no step, so the register is retired here rather than mapped onto steps no frame uses.

| Step | Multiplier | Value    |
| ---- | ---------- | -------- |
| xs   | 1          | 0.25rem  |
| sm   | 2          | 0.5rem   |
| md   | 3.5        | 0.875rem |
| lg   | 6          | 1.5rem   |
| xl   | 10         | 2.5rem   |
| 2xl  | 16         | 4rem     |
| 3xl  | 24         | 6rem     |

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

## Layout

Capture widths are 320, 768, 1280 and 1536 pixels, declared once in `tooling/web/configs/e2e/screenshot.ts`, with 320 and 1280 committed as evidence. 320 is the reflow floor and the rest are the breakpoint buckets. The landing page under `web/` sets its own `max-width` media queries between 430 and 1100 pixels per component rather than from a shared scale.

## Motion

Motion is not used. No transition, animation, or keyframe declaration appears on any rendered surface, and the capture pipeline screenshots a static frame.

## Iconography

No icon library is installed. `assets/brand/mark.svg` is the one authored icon, embedded inline in the hero topbar, and the surfaces otherwise draw literal glyph characters: `│ ├ ✓ ! ✗ + - ◆ ◇ ❯` for the terminal framing.

The same mark ships in five independently-maintained copies that carry different colors by design rather than by drift, each fitted to the chrome it renders on: the dark accent for a dark-chrome surface, the light accent for a light-chrome one, and the pair the web favicon takes from `src/design/favicon.ts`, which teach pages also take by rendering the live mark. Unifying them or repairing the one that looks drifted would break the fit each was chosen for. `canon/context/design.md` carries which file holds each copy.
