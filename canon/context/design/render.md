---
title: Render
description: The render preview, the verify tag and confidence count, embedded fonts, and the cells it cannot paint
---

# Render

## Overview

`canon design render` reads `canon/DESIGN.md` and writes an HTML plus CSS preview to `.canon/tmp/render/design/`. The HTML shows swatches, type samples, spacing bars, and border exemplars, and the CSS holds tokens as custom properties. `src/design/parse.ts` and `render.ts` own it, and flags live in `docs/agents/commands.md`.

The output is gitignored scratch the command regenerates, and `canon records push` never carries it. Do not stage the preview. No capture of it is committed either, in `examples/` or as a dev baseline under `assets/evidence/design/`.

- `examples/design/DESIGN.md` is the intent record for an invented project. A record with no values previews as its Overview paragraph and a column of unset swatches, which misleads more than it shows.
- The `design` gate stage reads that example against the prose budget
- `canon/context/development/evidence.md` owns the dev baseline boundary

## Decisions

### The parser carries the uncertainty tag

A cell no source anchors shows a `? verify` marker beside its value, and a confidence line above the sections counts anchored cells against tagged ones. A parsed cell is a `{ value, tagged }` pair rather than a string, so every swatch, sample, bar, and custom property is built from the value while the marker renders as its own element.

Leaving the marker inside the string would put the strip back in every emitter, where one that forgets writes the tag into a `style` attribute.

- A tagged cell wrapped in a code span keeps the span
- The parser matches the tag with any span removed, then restores the span around the clean value
- Dropping the span would change how an untagged code-span cell renders, and holding an untagged record byte-identical decides that

### The confidence count reads anchorable columns

The count reads the columns a source could anchor rather than every cell. Each table's first column names its row, and `Multiplier` and `When used` restate what the row carries, so none of the four is counted.

A cell tagged outside that set counts anyway, which keeps a drawn marker inside the ratio beside it. Counting every non-blank cell read 93 percent over a record carrying eight proposals, since 43 of its 120 cells could only ever be anchored. The scoped count reads 64 of 72.

- A record with no tagged cell gets neither the count nor the marker style
- `src/design/parse.test.ts` and `render.test.ts` cover both tag spellings, the columns, and the untagged render

## Gotchas

### What the preview draws

Motion and Iconography draw as a list when every line of the section is a bullet, and as one paragraph otherwise. Overview always draws as a paragraph. A rule under a token table never reaches the preview, since `prose()` reads only those three sections.

### Fonts

The preview declares no face by default. It emits a system stack and no `@font-face`, so a typography cell naming an undefined face falls through to the machine's.

- `--embed-fonts` declares each vendored face a `Family` cell names, with `font-display: block` and a data URI, and sets the body in the `body` role's stack
- The landing page opts in through `scripts/core/regen-web-previews.ts`
- A target's render stays byte-identical, since the faces add about 126 KB to `design.css`

### Cells the preview cannot paint

A code-span cell still emits its backticks. `` `#E4DCD0` `` reaches `design.css` and the `style` attribute intact, so that swatch paints nothing whether or not it carries a tag. Write a token cell as a bare value, which is what the seed shows.

- `--color-warning: ANSI 33` is not a color, so its `style` attribute is dropped and those swatches paint nothing. The render has no answer for a non-hex token.
- The two terminal color rows still record the ANSI code, since no rendered surface implements an equivalent
- `success` is the one terminal role with a rendered equivalent, since `assets/captures/install.html` marks every confirmed step with it
- It carries `#61c454`, emits a property, and earns a contrast reading against `background`, the only ground it is drawn on
- The shell still writes `ANSI 32` for `success`, so no reading claims the terminal renders that hex
