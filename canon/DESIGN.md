---
reviewed: 2026-11-10
---

# Design

Authoring guidance: `claude/skills/design-record/references/design.md`. Rendered from `src/design/tokens.ts` by `canon design regen`, so edit the module and never this file. Why each value was chosen lives in `canon/context/features/design.md`.

## Overview

Warm neutral grounds with ink text, set in Geist, and Geist Mono where a surface shows a path, a command, or what a shell printed. Product windows sit on a soft tray. The vermilion pip of the mark is the one accent, marking a status the surface would color.

## Colors

- One accent, the mark's pip. Never promote a second color into a structural role.
- Every text role clears WCAG AA at 4.5:1 against each ground it is drawn on.
- `waiting` colors product-view glyphs, never text. `warning` and `error` exist only in the terminal, as ANSI codes.

| Role             | Intent                                                  | Value   |
| ---------------- | ------------------------------------------------------- | ------- |
| background       | page canvas                                             | #121211 |
| surface          | the tray a product window sits in, and cards            | #1a1a18 |
| window           | the body of a product window                            | #1e1e1e |
| chrome           | the window titlebar                                     | #252523 |
| band             | a highlighted run inside a window, such as a prompt     | #282826 |
| border           | every rule and divider                                  | #2e2e2c |
| edge             | the outline of a card on the tray                       | #2a2a28 |
| text             | headings, counts, emphasized runs                       | #f2f2f0 |
| text-body        | default body copy                                       | #cfcdc8 |
| muted            | ledes, labels, captions, trailing notes                 | #8f8d88 |
| accent           | the pip, and a status the surface would color           | #ff6b42 |
| success          | done, rendered and in the terminal                      | #6fae6a |
| waiting          | a product-view glyph for work not yet done              | #e5b567 |
| warning          | terminal cautions                                       | ANSI 33 |
| error            | terminal failures                                       | ANSI 31 |
| light-background | page canvas on a light ground                           | #fdfdfc |
| light-surface    | the tray and cards on a light ground                    | #f2f2f0 |
| light-window     | the body of a product window on light                   | #ffffff |
| light-chrome     | the window titlebar on light                            | #f7f7f5 |
| light-band       | a highlighted run inside a window on light              | #f0f0ee |
| light-border     | rules and dividers on light                             | #ececea |
| light-edge       | the outline of a card on the tray, on light             | #e4e4e1 |
| light-text       | primary text on a light ground                          | #121212 |
| light-text-body  | default body copy on a light ground                     | #3b3b38 |
| light-muted      | ledes, labels, and captions on a light ground           | #6b6a66 |
| light-accent     | the pip, and a status the surface would color, on light | #c2380e |
| light-success    | done, rendered and in the terminal, on light            | #3f7f3e |
| light-waiting    | a product-view glyph for work not yet done, on light    | #b07d1a |

## Typography

- Geist for every role except `code` and `view`, which take Geist Mono.
- Tracking: `hero` at `-0.04em`, `display` at `-0.03em`, nothing else.
- Seven steps, five on a 4:3 ratio from body 16 and two inside product windows. A role takes one step.

| Role       | Family                                           | Weight | Size      | Tablet    | Phone      | Line height   |
| ---------- | ------------------------------------------------ | ------ | --------- | --------- | ---------- | ------------- |
| hero       | Geist Variable, DejaVu Sans, sans-serif          | 600    | 5.625rem  | 4rem      | 2.5rem     | 1             |
| display    | Geist Variable, DejaVu Sans, sans-serif          | 600    | 3.125rem  | 2.5rem    | 2rem       | 1.06          |
| lede       | Geist Variable, DejaVu Sans, sans-serif          | 400    | 1.3125rem | 1.125rem  | 1.0625rem  | 1.48          |
| title      | Geist Variable, DejaVu Sans, sans-serif          | 600    | 1rem      | 1rem      | 0.9375rem  | 1.55          |
| body       | Geist Variable, DejaVu Sans, sans-serif          | 400    | 1rem      | 1rem      | 0.9375rem  | 1.55          |
| small      | Geist Variable, DejaVu Sans, sans-serif          | 500    | 0.8125rem | 0.8125rem | 0.78125rem | 1.45          |
| view       | Geist Mono Variable, DejaVu Sans Mono, monospace | 400    | 0.8125rem | 0.8125rem | 0.75rem    | 1.6           |
| view-small | Geist Variable, DejaVu Sans, sans-serif          | 500    | 0.75rem   | 0.6875rem | 0.6875rem  | 1.45          |
| code       | Geist Mono Variable, DejaVu Sans Mono, monospace | 400    | 0.8125rem | 0.8125rem | 0.78125rem | 1.45 ? verify |

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

## Layout

- Capture widths: 320, 768, 1280, 1536. 320 is the reflow floor.
- Every width query in the generated stylesheets opens a range one of these widths reaches.

## Shapes

- Every border is one pixel solid, in `border` for a rule and `edge` around a card. Radius and width are independent.
- The tray steps down to 28px under 900 and 22px under 640.
- No pill. A one-line picker takes `action` at 28px high.

| Role   | Radius | Width | When used                                          |
| ------ | ------ | ----- | -------------------------------------------------- |
| tray   | 36px   | none  | the soft tray a product window sits in             |
| frame  | 12px   | none  | windows, sheets, popovers, a picked or hovered row |
| panel  | 12px   | 1px   | cards and columns, edged in `edge`                 |
| action | 8px    | none  | controls, the install command, one-line pickers    |
| chip   | 4px    | none  | chips and tags                                     |
| rule   | none   | 1px   | horizontal dividers between bands                  |
| marker | 2px    | none  | status marks and the status dot, sized at 6px      |

| Token                    | Value                                                                     | When used                                |
| ------------------------ | ------------------------------------------------------------------------- | ---------------------------------------- |
| `--shadow-window`        | 0 0 0 1px rgba(255, 255, 255, 0.06), 0 24px 60px -28px rgba(0, 0, 0, 0.6) | a product window on its tray             |
| `--shadow-popover`       | 0 0 0 1px rgba(255, 255, 255, 0.06), 0 16px 36px -16px rgba(0, 0, 0, 0.6) | a menu or popover over content           |
| `--shadow-ring`          | 0 0 0 1px rgba(255, 255, 255, 0.06)                                       | a hairline around a picked row           |
| `--shadow-light-window`  | 0 0 0 1px rgba(0, 0, 0, 0.07), 0 24px 60px -28px rgba(0, 0, 0, 0.3)       | a product window on its tray, on light   |
| `--shadow-light-popover` | 0 0 0 1px rgba(0, 0, 0, 0.07), 0 16px 36px -16px rgba(0, 0, 0, 0.3)       | a menu or popover over content, on light |
| `--shadow-light-ring`    | 0 0 0 1px rgba(0, 0, 0, 0.07)                                             | a hairline around a picked row, on light |

## Motion

- Four durations and two curves. Progress runs linear, and nothing sets a timing of its own.
- Product-view loops keep Claude Code's rhythm: a 1.6s spinner, a 1.4s pulse, a 1.1s cursor blink.
- Under reduced motion every end state renders at once, so a duration is never the only way to reach one.

| Token                 | Value                          | When used                     |
| --------------------- | ------------------------------ | ----------------------------- |
| `--duration-feedback` | 120ms                          | hover, press, and toggle      |
| `--duration-fade`     | 240ms                          | a fade in or out              |
| `--duration-move`     | 400ms                          | an element moving or resizing |
| `--duration-draw`     | 1000ms                         | a line or figure drawing on   |
| `--ease-standard`     | cubic-bezier(0.3, 0.7, 0.3, 1) | fades and moves               |
| `--ease-draw`         | cubic-bezier(0.65, 0, 0.35, 1) | draws                         |

## Iconography

- No icon library. `assets/brand/mark.svg` is the one authored icon.
- The mark takes its colors from `src/design/favicon.ts`: the c in the text ink and the pip in the accent pair.
- The terminal draws glyphs: `│ ├ ✓ ! ✗ + - ◆ ◇ ❯`.
