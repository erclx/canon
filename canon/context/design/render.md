---
title: Render
description: The canon design render preview, how the parser carries the verify tag, the confidence count and the columns it reads, embedded fonts, and the token cells the preview cannot paint
---

# Render

## Overview

`canon design render` reads `canon/DESIGN.md` and writes an HTML plus CSS preview to `.canon/tmp/render/design/`. The HTML shows color swatches, typography samples, spacing bars, and border exemplars, and the CSS holds tokens as custom properties for copy-paste into a project stylesheet. `src/design/parse.ts` and `src/design/render.ts` own it. Flags live in `docs/agents/commands.md`.

The output sits under `.canon/tmp/render/`, gitignored scratch the command regenerates and `canon records push` never carries. Do not stage the preview.

## Decisions

### The parser carries the uncertainty tag

A cell no source anchors shows a `? verify` marker beside its value, and a confidence line above the sections names how many cells are anchored against how many are tagged. A parsed cell is a `{ value, tagged }` pair rather than a string, so `Row` is a map of cells and every swatch, sample, bar, and custom property is built from the value while the marker renders as its own element. Leaving the marker inside the string was the alternative, and it puts the strip back in every emitter, where one that forgets writes the tag into a `style` attribute.

A tagged cell wrapped in a code span keeps the span. The tag is matched against the cell with any surrounding span removed, then the span is restored around the clean value, since dropping it would change how an untagged code-span cell renders. Holding an untagged record byte-identical is what decides that.

### The confidence count reads anchorable columns

The count reads the columns a source could anchor rather than every cell. Each table's first column names its row, and `Multiplier` and `When used` restate what the row already carries, so none of the four is counted. A cell tagged outside that set counts anyway, which keeps a drawn marker inside the ratio beside it.

Counting every non-blank cell was the rejected alternative. Against the toolkit's own record it produced a denominator of 120, 43 of which could only ever be anchored, reading 93 percent confidence over a record carrying eight proposals. The scoped count reads 64 of 72.

A record with no tagged cell gets neither the count nor the marker style, so nothing about it moves. `src/design/parse.test.ts` and `src/design/render.test.ts` cover both tag spellings, the count and the columns it reads, and the untagged render.

## Gotchas

- The preview declares no face by default. It emits a system stack and no `@font-face`, so a typography cell naming a face nothing defines falls through to whatever the machine resolves. `--embed-fonts` declares each vendored face a `Family` cell names, with `font-display: block` and a data URI, and sets the body in the `body` role's stack. The landing page opts in through `scripts/core/regen-web-previews.ts`, and a target's render stays byte-identical, since the faces add about 126 KB to `design.css`.
- A code-span cell still emits its backticks. `` `#E4DCD0` `` reaches `design.css` and the `style` attribute intact, so that swatch paints nothing whether or not it carries a tag. Write a token cell as a bare value, which is what the seed shows.
- Two terminal color rows emit a token no consumer resolves. `--color-warning: ANSI 33` is not a color, so its `style` attribute is dropped and those swatches paint nothing. Recording the ANSI code is still right for those two, since no rendered surface implements an equivalent, and the gap is that the render has no answer for a non-hex token.
- `success` is the one terminal role with a rendered equivalent. `assets/captures/install.html` marks every confirmed step with it, so the role carries `#61c454`, emits a property, and earns a contrast reading against `background`, the only ground it is drawn on. The shell still writes `ANSI 32` for the same role, so no reading claims the terminal renders that hex.
