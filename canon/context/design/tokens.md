---
title: Token module
description: The modules under src/design and what each owns, the three surfaces reading the tokens, the component layer, type and space scales, the font families, color derivation, and the brand mark's five copies
---

# Token module

## Overview

`src/design/tokens.ts` holds this repository's design values, and every generated stylesheet, the slide theme, and the capture frames read them from there. `canon/context/design/overview.md` states why the record is generated rather than authored.

## Decisions

### Three surfaces read the module

The slide theme takes bare hex through `bareHex`, since `PptxGenJS` receives `{ color: theme.background }` and PowerPoint has no concept of a custom property. The token preview's own chrome and a teach workspace stylesheet take custom properties through `@/design/css`. The hero and the terminal framing carry their own copies, so the record is the source for three surfaces and a description of two.

The consolidated dark set is the palette the hero already draws, so no capture needed to move. It clears one of the two contrast failures too: the hero's rust reads 5.77 and 5.36 against the two dark grounds, where the slide theme's reads 4.36 and 3.99.

### The component layer lives in code

The component layer lives in `src/design/components.ts` rather than in the record, because `standards/design.md` keeps CSS class names out of that document. `TEACH_COMPONENTS`, the six-entry teach chrome of masthead, article, quiz, glossary, outline, and references, sits beside the generic default rather than inside it, and a caller opts in by passing an explicit list to `buildDesignCss`'s `components` option, which keeps a masthead and a quiz out of a project that never asked for teach.

`COMPONENTS` holds three: a status marker, a scrollbar, and `HAND_DRAWN_FIGURE`, which draws one hand-drawn figure without teach's quiz or schedule machinery. It declares its own `--figure-hand` and `--figure-wide` defaults rather than reading `TEACH_CHROME`'s `--teach-hand` and `--teach-wide`, which keeps it independent of teach.

### The light theme remaps declared roles

The light theme remaps the roles the record declares a `light-` counterpart for, and `unmappedOnLight` names the rest. Filling those in was the alternative, and it would put a color in the system that no surface reads, so the emitted stylesheet names the gap in a comment instead.

### Breakpoints live in the record's layout section

`## Layout` in the record is read as text by the `440-surface-capture` rule to find a project's breakpoints, and the renderer and parser ignore it, so nothing visual confirms it landed. The `capture widths` block in `src/design/css.test.ts` checks the widths instead: it reads them from `tooling/web/configs/e2e/screenshot.ts` and fails when a width query in the generated base or teach stylesheet opens a range none of them reaches, or when the record stops naming the same widths. The `web/` queries follow no shared scale and sit outside that check. This repository's record carries the section through `layout` in `src/design/tokens.ts`, since a hand edit to the generated document fails the `design` gate stage.

## Gotchas

### Type and space scales

- The seven type steps and the roles are separate sets. `typeScale` holds `t0` through `t6`, emitted as `--t0` to `--t6`, while each role's size is one of those values. A step scheme answers what sizes exist and a role scheme answers what a stylesheet asks for, so collapsing them would force every consumer to know which step its text is. The steps stay out of the `Typography` table because `table()` in `src/design/parse.ts` reads every pipe row in a section as one table. `t3` and `t6` have no role.
- The space steps are `xs` through `3xl` at 0.25, 0.5, 0.875, 1.5, 2.5, 4, and 6 rem, and no frame register exists since no consumer read one. The capture templates hardcode their own sizes and padding.
- `tokenProperties` in `src/design/css.ts` emits `--type-<role>-family` beside `--type-<role>-size` and `--type-<role>-lh`, so a rendered surface consumes the font identity rather than restating it.

### Font families

- The record claims two families. Every role but `code` is Geist, embedded through `FONT_FACES`, and `code` plus any terminal frame is monospace, stated as a role. The landing page retires the `code` role and sets its code in Geist, which `canon/context/web/overview.md` records. `TEACH_CHROME` points `--teach-sans` and `--teach-mono` at `--type-body-family` and `--type-code-family` and keeps only the hand-drawn pair as its own.
- `src/design/fonts.ts` exports `HAND_DRAWN_FONT_FACES`, Virgil then Excalifont, beside `FONT_FACES`, which holds the two Noto Sans Mono statics and the `Geist Variable` face declaring `font-weight: 100 900`, so `FontFace.weight` carries a range as well as a single weight. `TEACH_FONT_FACES` spreads the hand-drawn set in rather than holding its own Virgil copy.
- The vendored Geist subset has no box-drawing, arrow, check, or diamond glyphs, which teach and terminal copy print. The stack names `DejaVu Sans` second, which carries all four ranges, and a larger subset would grow the base64 every embedding stylesheet ships. Revisit if a surface shows the fallback mismatching Geist in weight.
- `src/design/base.css` has two writers that disagree past 80 columns. `canon design regen` writes each declaration flat and prettier wraps anything longer, so the `design` stage fails on the drift between them. Any value added to the module has to render inside that width, which is why the proportional stack for `page-display` stops at two names and a generic.

### Color

- The accent anchors carry two chroma steps, 0.13 light and 0.12 dark for a mark and 0.095 light and 0.09 dark for a fill. Only the mark step is a token, as `accent`, which also does fill duty in `assets/captures/hero.html`'s `.cmd` button. The fill step sits in the module's `colorNote` as an anchor with no token of its own.
- A role declaring more than one ground solves its OKLCH derivation against the tighter of the two. `muted` and `light-muted` each declare `background` and `surface`, and a lightness solved against `background` alone read 4.40 dark and 4.24 light against `surface`, which `src/design/contrast.test.ts` catches since it measures every declared ground.
- The slide theme and the two rendered captures agree by construction. `scripts/core/regen-hero.sh` fills a `{{TOKENS}}` placeholder in each `assets/captures/*.html.tmpl` with what `canon design css --no-components` emits, so a value moved in the module moves both frames. The component half is left out on purpose, since a static capture renders neither the status marker nor the webkit scrollbar.
- `src/design/css.test.ts` cannot cover `TEACH_STYLESHEET_COMPONENTS` through each component's `reads` array alone, which is self-satisfying for a name a component both declares and reads. `TEACH_CHROME` declares seven legacy alias properties, `--panel`, `--rule`, `--ink`, `--ink-soft`, `--ink-faint`, `--accent`, and `--accent-bg`, that a hand-authored lesson diagram consumes by name. A second test derives its required names from a fixture shaped like a lesson diagram's `var(--name)` references.

### The brand mark

The toolkit's one authored icon, `assets/brand/mark.svg`, is not a design token. `regen-hero.sh` reads it directly and fills a `{{MARK_SVG}}` placeholder beside `{{TOKENS}}`, landing in the hero's topbar `.mark` slot as inline markup. The `iconography` field in `src/design/tokens.ts` names it.

The mark ships in five independently maintained copies rather than through one shared verb. `regen-hero.sh` derives its copy from the live SVG and accent on every run, and `scripts/core/regen-web-favicon.ts` regenerates `web/public/favicon.svg` from the live SVG. Teach pages read the live SVG at `canon teach nav` time through `faviconLink` in `src/design/favicon.ts`, which is why `package.json` ships `assets/brand/mark.svg`. `src/design/render.ts`'s hardcoded path data and the README pair `mark-accent.svg` and `mark-accent-light.svg` are static text nothing checks, so a change to the mark's shape leaves them behind. The trade waits for a second surface asking for a shared icon before lifting a helper.

The five copies carry different colors on purpose. `regen-hero.sh` uses the dark `accent` role, `#c76b5f`, matching the dark capture chrome. `src/design/render.ts` uses `light-accent`, `#ad4a4b`, since the preview renders on light chrome and a data URI has no CSS context. The README pair carries each on the page background GitHub renders it on. The favicon and teach pages take `#c42938` light and `#e54e40` dark from `FAVICON_COLORS`, a chroma raised for legibility at tab size, reading no page token. Unifying the five onto one color breaks the fit each was chosen for.

## Hidden contracts

- `src/design/tokens.ts` owns the values, and `components.ts` beside it owns the component layer built on them
- `src/design/document.ts` renders the record, `css.ts` renders the stylesheet, and `regen.ts` writes both through `canon design regen`
- `src/design/neutral.ts` owns the neutral set `base.css` renders from, sharing every non-color token with `TOKENS` by spread and held to the same color roles by `neutral.test.ts`
- `src/design/adapter.ts` owns the sync adapter, and `src/design/base.css` is the generated file it installs
- `src/design/contrast.ts` owns the WCAG reading, asserted over the record in `contrast.test.ts`
