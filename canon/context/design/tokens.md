---
title: Token module
description: The modules under src/design, the surfaces reading the tokens, the scales, fonts, color derivation, and the brand mark copies
---

# Token module

## Overview

`src/design/tokens.ts` holds this repository's design values, and every generated stylesheet and the capture frames read them from there. `canon/context/design/overview.md` states why the record is generated rather than authored.

The module's prose slots are lists of one-line rules. The record carries values and rules, and this entry carries the reasons. A value whose why needs a paragraph adds it here, never to the module.

## Decisions

### Two surfaces read the module

The token preview's chrome and a teach workspace stylesheet take custom properties through `@/design/css`. The hero and the terminal framing carry their own copies, so the record is the source for two surfaces and a description of two.

A slide deck reads the project's own tokens through the canvas resolution, so it takes the project's design rather than Canon's. The consolidated dark set is the palette the hero draws. The hero's rust reads 5.77 and 5.36 against the two dark grounds, where the slide theme's reads 4.36 and 3.99.

### The component layer lives in code

`src/design/components.ts` holds the layer rather than the record, because `claude/skills/canvas-board/references/design.md` keeps CSS class names out of that document.

- `COMPONENTS` holds three: a status marker, a scrollbar, and `HAND_DRAWN_FIGURE`, which draws one hand-drawn figure without teach's quiz or schedule machinery
- `TEACH_COMPONENTS` is the six-entry teach chrome, being masthead, article, quiz, glossary, outline, and references
- A caller opts into teach by passing an explicit list to `buildDesignCss`'s `components` option, which keeps a masthead and a quiz out of a project that never asked for teach
- `HAND_DRAWN_FIGURE` declares its own `--figure-hand` and `--figure-wide` rather than reading `TEACH_CHROME`'s, so it stays independent of teach

### The light theme remaps declared roles

The light theme remaps the roles the record declares a `light-` counterpart for, and `unmappedOnLight` names the rest. Filling the rest in would put a color in the system that no surface reads, so the emitted stylesheet names the gap in a comment.

### Breakpoints live in the record's layout section

The `surface-capture` rule reads `## Layout` as text to find a project's breakpoints, and the renderer and parser ignore it, so nothing visual confirms it landed. The `capture widths` block in `src/design/css.test.ts` checks instead.

- It reads the widths from `tooling/web/configs/e2e/screenshot.ts`
- It fails when a width query in the generated base or teach stylesheet opens a range none of them reaches, or when the record stops naming the same widths
- The `web/` queries follow no shared scale and sit outside the check
- This repository's record carries the section through `layout` in `src/design/tokens.ts`, since a hand edit to the generated document fails the `design` gate stage

## Gotchas

### Type and space scales

The seven type steps and the roles are separate sets. `typeScale` holds `t0` through `t6`, emitted as `--t0` to `--t6`, and each role's size is one of those values. Collapsing them would force every consumer to know which step its text is.

- The steps stay out of the `Typography` table because `table()` in `src/design/parse.ts` reads every pipe row in a section as one table. `t3` and `t6` have no role.
- The steps paint at 50.8, 38, 22, 18, 15, 13, and 11 pixels. Only the hero headline takes `t0`, since a headline at the display cap reads as an opening.
- The space steps are `xs` through `3xl` at 0.25, 0.5, 0.875, 1.5, 2.5, 4, and 6 rem. No frame register exists, and the capture templates hardcode their own sizes.
- The space scale is not a grid of one base. A control needs the 14 pixels between 8 and 24 and no multiple of four supplies it, so the multiplier column counts quarter rems.
- `tokenProperties` in `src/design/css.ts` emits `--type-<role>-family` beside `-size` and `-lh`, so a surface consumes the font identity rather than restating it.

### Font families

The record claims two families. Every role but `code` is Geist, embedded through `FONT_FACES`, and `code` plus any terminal frame is monospace. The landing page retires the `code` role and sets its code in Geist, which `canon/context/web/overview.md` records.

- `TEACH_CHROME` points `--teach-sans` and `--teach-mono` at `--type-body-family` and `--type-code-family` and keeps only the hand-drawn pair as its own
- `src/design/fonts.ts` exports `HAND_DRAWN_FONT_FACES`, Virgil then Excalifont, beside `FONT_FACES`
- `FONT_FACES` holds the two Noto Sans Mono statics and the `Geist Variable` face declaring `font-weight: 100 900`, so `FontFace.weight` carries a range
- `TEACH_FONT_FACES` spreads the hand-drawn set in rather than holding its own Virgil copy
- The synced `base.css` carries no `@font-face`. A consumer embeds the vendored faces it names at injection, as the canvas does, so the tokens and the faces each stay one copy.

### Project faces and glyphs

A project's own faces sit in `.claude/design/project/fonts/` with plain `@font-face` rules in `project/fonts.css`. `canon design fonts add` writes that file and `src/design/project-fonts.ts` reads it.

- A project rule for a vendored family replaces the vendored face
- Reading descriptors from the font's own tables would need a Brotli parser to open WOFF2
- The vendored Geist subset has no box-drawing, arrow, check, or diamond glyphs, which teach and terminal copy print
- The stack names `DejaVu Sans` second for those four ranges, since a larger subset grows the base64 every embedding stylesheet ships. Revisit if the fallback mismatches Geist in weight.

### The base stylesheet wraps at 80 columns

`src/design/base.css` has two writers that disagree past 80 columns. `canon design regen` writes each declaration flat and oxfmt wraps anything longer, so the `design` stage fails on the drift.

A value added to the module has to render inside that width. That is why the proportional stack for `page-display` stops at two names and a generic.

### Color derivation

Every hex role but `success` is derived rather than picked. Each solves in OKLCH by binary search for the lightness that hits a target contrast against its ground. Dark is its own anchor set rather than an inversion of light.

| Anchor             | Light | Dark  |
| ------------------ | ----- | ----- |
| Ground lightness   | 0.985 | 0.165 |
| Neutral chroma     | 0.003 | 0.004 |
| Neutral hue        | 90    | 90    |
| Accent hue         | 22    | 28    |
| Accent mark chroma | 0.13  | 0.12  |
| Accent fill chroma | 0.095 | 0.09  |

- Only the mark step is a token, as `accent`, which also does fill duty in the hero's `.cmd` button. A lower-saturation `accent-fill` would recolor that button, not reach a new consumer.
- The contrast targets are inputs, being text 13.5, body 8.6, secondary 5.6, muted 4.6, and accent 5.2
- `src/design/contrast.test.ts` asserts every role clears WCAG AA at 4.5:1 against each ground it declares
- A role with two grounds solves against the tighter. `muted` solved against `background` alone read 4.40 dark and 4.24 light on `surface`, and solved against `surface` it reads 4.58 and 4.56.

### Color roles

The accent is a quiet red at hue 22 light and 28 dark. A vivid red read as an error state on a page reporting success, indigo at hue 280 reads as generic in tooling, and rust at hue 42 shifted temperature further than the problem asked.

- The cost is that `error` and `warning` share a register with the accent, so they are told apart by lightness or an icon rather than hue
- `success` is the one role picked rather than derived, and the one terminal role carrying a hex, since `assets/captures/install.html` marks every confirmed step with it while the shell writes `ANSI 32`
- `success` declares `background` alone as its ground, the only one it is drawn on
- `warning` and `error` hold the ANSI codes `scripts/lib/ui.sh` writes, since no rendered surface implements an equivalent
- A hex for either would invent a mapping no file has, so neither carries a contrast reading

### Color consumers

The terminal framing keeps its own values on purpose. `scripts/lib/ui.sh` and `src/cli/ui.ts` each spell six escape constants, and `canon/context/scripts/framing.md` records one color source per language with a check behind each.

A third spelling generated from the module would break that rule. `WHITE` and `GREY` name no role, so the record describes the terminal palette in part.

- The rendered captures agree with the module by construction: `scripts/core/regen-hero.ts` fills `{{TOKENS}}` in each `assets/captures/*.html.tmpl`, so a moved value moves both frames
- The component half is left out, since a static capture renders neither the status marker nor the webkit scrollbar
- A component's `reads` array cannot cover `TEACH_STYLESHEET_COMPONENTS` in `src/design/css.test.ts`, since a name it both declares and reads satisfies itself
- `TEACH_CHROME` declares seven legacy aliases that a lesson diagram consumes by name, `--panel`, `--rule`, `--ink`, `--ink-soft`, `--ink-faint`, `--accent`, and `--accent-bg`
- A second test derives the required names from a fixture shaped like a lesson diagram

### The brand mark

The toolkit's one authored icon, `assets/brand/mark.svg`, is not a design token. `regen-hero.ts` reads it directly and fills a `{{MARK_SVG}}` placeholder in the hero's topbar `.mark` slot. The `iconography` field in `src/design/tokens.ts` names it.

It ships in five independently maintained copies rather than through one shared verb.

- `regen-hero.ts` derives its copy from the live SVG and accent on every run
- `scripts/core/regen-web-favicon.ts` regenerates `web/public/favicon.svg` from the live SVG
- Teach pages and the canvas shell read the live SVG through `brandFavicon()` in `src/design/brand-favicon.ts`, which is why `package.json` ships `assets/brand/mark.svg`
- `brand-favicon.ts` sits apart from `favicon.ts`, which imports nothing so the card build can load it
- `src/design/render.ts`'s hardcoded path data and the README pair `mark-accent.svg` and `mark-accent-light.svg` are static text nothing checks, so a change to the mark's shape leaves them behind

### Why the five colors differ

Each copy fits the surface it sits on, and unifying them onto one color breaks that fit.

| Copy            | Color                                          |
| --------------- | ---------------------------------------------- |
| `regen-hero.ts` | dark `accent`, `#c76b5f`, matching dark chrome |
| `render.ts`     | `light-accent`, `#ad4a4b`, on light chrome     |
| README pair     | each on the background GitHub renders it on    |
| Favicon, teach  | `#c42938` light, `#e54e40` dark                |

The favicon pair comes from `FAVICON_COLORS`, a chroma raised for legibility at tab size, reading no page token. `render.ts` has no CSS context in a data URI, so it carries a literal.

### Hidden contracts

Each module owns one piece of the pipeline.

- `src/design/tokens.ts` owns the values, and `components.ts` beside it owns the component layer built on them
- `src/design/document.ts` renders the record, `css.ts` the stylesheet, and `regen.ts` writes both through `canon design regen`
- `src/design/neutral.ts` owns the neutral set `base.css` renders from, sharing every non-color token with `TOKENS` by spread and held to the same color roles by `neutral.test.ts`
- `src/design/adapter.ts` owns the sync adapter, and `src/design/base.css` is the generated file it installs
- `src/design/contrast.ts` owns the WCAG reading, asserted over the record in `contrast.test.ts`
