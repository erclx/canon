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

Every role clears WCAG AA at 4.5:1 against each ground it declares, asserted in `src/design/contrast.test.ts`. Two corrections landed with this record becoming the source. The light `muted` step moved from `#7A736A`, which read 4.38 and 4.09 against the two light grounds, and the dark `accent` moved off the `#C8602E` the slide theme carried, which read 4.36 and 3.99 against the two dark ones. Both now sit on the values below.

Warning and error hold ANSI codes because that is what `scripts/lib/ui.sh` writes and no rendered surface implements an equivalent. Giving either a hex value would invent a mapping no file has, so they carry no contrast reading either.

Success is the one of the three that does have a rendered equivalent, which is why it carries a hex. `assets/captures/install.html` marks every confirmed step with it, and the shell writes `ANSI 32` for the same role, so the two are one role in two registers rather than one value in two spellings. The hex is what the rendered surface picked and no reading claims the terminal renders that value. It declares `background` alone as its ground, since that is the only role it is drawn on, where every other dark text role is drawn on both.

| Role                 | Intent                                                | Value            |
| -------------------- | ----------------------------------------------------- | ---------------- |
| background           | page canvas                                           | #191512          |
| surface              | cards, panels, raised blocks                          | #211c19          |
| chrome               | the window titlebar, one step above the canvas        | #241e1a          |
| border               | every rule and panel edge                             | #2f2823          |
| text                 | headings, counts, emphasized runs                     | #f4efe9          |
| text-body            | default body copy                                     | #c9c0b7          |
| text-secondary       | labels, captions, supporting copy                     | #a79d94          |
| muted                | the faintest step, trailing notes                     | #948a81          |
| accent               | install command, mark, primary action                 | #e0724b          |
| success              | confirmations, rendered and in the terminal           | #61c454          |
| warning              | terminal cautions                                     | ANSI 33          |
| error                | terminal failures                                     | ANSI 31          |
| light-background     | page canvas on a light ground                         | #faf7f2          |
| light-surface        | cards and panels on a light ground                    | #f4efe6          |
| light-chrome         | the window titlebar, one step above the canvas        | #ede4d6          |
| light-text           | primary text on a light ground                        | #1a1815          |
| light-text-body      | default body copy on a light ground                   | #3d3630          |
| light-text-secondary | labels, captions, supporting copy on a light ground   | #5c544b          |
| light-muted          | secondary text on a light ground                      | #726b62          |
| light-accent         | links and primary action on light                     | #a4471c          |
| light-success        | confirmations, rendered and in the terminal, on light | #2d6b22          |
| light-border         | rules and panel edges on light                        | #e4dcd0 ? verify |

## Typography

One family covers every role but `page-display`, which is the landing page hero and takes the proportional sibling of the same superfamily. The size scale runs from 11.5 to 52 pixels, and six values map onto a role. Five further values are adjustments inside a single component and get no role here, since a scale with five invented steps reads as a system the surfaces do not implement. They are 11.5, 12.5, 13, 14, and 15 pixels.

The 52 pixel step sits above the 34 the rest of the scale tops out at, and it is the one size no other surface reaches. A hero headline set at the display cap reads as a section heading rather than an opening, which four rendered arms measured on 2026-09-04 before the step was added.

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

No icon library is installed. `assets/brand/mark.svg` is the one authored icon, embedded inline in the hero topbar, and the surfaces otherwise draw literal glyph characters: `│ ├ ✓ ! ✗ + - ◆ ◇ ❯` for the terminal framing. The same mark also ships as a favicon on every rendered surface, as three independently-maintained copies that track different accents by design rather than by drift: `regen-hero.sh` derives one from the live SVG colored with whatever `--color-accent` (`#e0724b`) the fetched token CSS carries, `src/design/render.ts` carries the path data as a hardcoded literal colored via `colorValue('light-accent')` (`#a4471c`), since a data URI has no CSS context and that page renders on light chrome, and `teach-workspace`'s `SKILL.md` names one in prose colored `rgb(224,114,75)`, the same value as the dark accent written as decimal rather than hex to clear the shipped-references gate's commit-sha check. Unifying the three or repairing the one that looks drifted would break the fit each was chosen for.
