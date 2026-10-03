# Design

Authoring guidance: `standards/design.md`. Rendered from `src/design/tokens.ts` by `canon design regen`. Edit the module, never this file. Why each value was chosen lives in `canon/context/design/tokens.md`.

## Personality

Warm neutrals under one rust accent, set in Geist. The page reads as prose, and monospace appears only where a surface shows what a shell printed. One accent carries every count, link, and primary action.

## Color

- One accent. Never promote a second color into a structural role.
- Every text role clears WCAG AA at 4.5:1 against each ground it is drawn on.
- `warning` and `error` exist only in the terminal, as ANSI codes.

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

- Geist for every role except `code`, which is monospace.
- Tracking: `label` at `0.05em`, `display` at `-0.01em`, nothing else.
- Sizes come from seven steps, `t0` to `t6`. A role takes one step.

| Role         | Family                                      | Weight       | Size              | Line height   |
| ------------ | ------------------------------------------- | ------------ | ----------------- | ------------- |
| display      | Geist Variable, DejaVu Sans, sans-serif     | 700          | 2.375rem          | 1.3           |
| page-display | Geist Variable, DejaVu Sans, sans-serif     | 700          | 3.175rem ? verify | 1.1 ? verify  |
| heading      | Geist Variable, DejaVu Sans, sans-serif     | 700          | 1.375rem          | 1.3 ? verify  |
| body         | Geist Variable, DejaVu Sans, sans-serif     | 400 ? verify | 0.9375rem         | 1.65          |
| label        | Geist Variable, DejaVu Sans, sans-serif     | 400 ? verify | 0.8125rem         | 1.45 ? verify |
| code         | Noto Sans Mono, DejaVu Sans Mono, monospace | 700          | 0.8125rem         | 1.3 ? verify  |

## Spacing

- Seven steps. `md` sits at 3.5 because a control needs 14 pixels.

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

- Every border is one pixel solid in `border`. Radius and width are independent.

| Role   | Radius         | Width         | When used                         |
| ------ | -------------- | ------------- | --------------------------------- |
| frame  | 12px           | none          | the outer window, radius only     |
| panel  | 10px           | 1px           | cards and columns                 |
| action | 7px            | none          | the install command block         |
| rule   | none           | 1px           | horizontal dividers between bands |
| pill   | 999px ? verify | none ? verify | tags and status chips, none built |
| marker | 999px          | none          | the status dot, sized at 6px      |

## Layout

- Capture widths: 320, 768, 1280, 1536. 320 is the reflow floor.
- Every width query in the generated stylesheets opens a range one of these widths reaches.

## Motion

- None. No transition, animation, or keyframe on any rendered surface.

## Iconography

- No icon library. `assets/brand/mark.svg` is the one authored icon.
- The terminal draws glyphs: `│ ├ ✓ ! ✗ + - ◆ ◇ ❯`.
