---
title: Design
description: DESIGN.md as a generated record, the token module and component layer it renders from, the render preview, and the neutral base a target inherits
---

# Design

## Overview

`canon/DESIGN.md` holds visual intent, being a short Overview, one-line rules, and a table naming what each role is for. This repository's record is generated from `src/design/tokens.ts` by `canon design regen`, and the `design` gate stage checks it for drift. A target writes its record by hand with no values.

## Layout

### `src/design/`

Owns the token module, the component layer, the renderers, the markdown parser, the sync adapter, and the contrast reading.

- `tokens.ts` holds the values. Every hex role but `success` is solved in OKLCH for a contrast target, and dark is its own anchor set.
- `components.ts` holds the component layer, since the record keeps CSS class names out. `buildDesignCss` takes `TEACH_COMPONENTS` only through its `components` option.
- `neutral.ts` holds the achromatic set `canon design install` hands a target, and `neutral.test.ts` holds its roles to the same list as `TOKENS`
- `document.ts` renders the record, `css.ts` the stylesheet, `regen.ts` writes both, and `budget.ts` counts the record against the prose budget
- `parse.ts` and `render.ts` write the gitignored preview at `.canon/tmp/render/design/`, and `prose()` reads only Overview, Motion, and Iconography, so no other rule reaches it

### `.claude/design/`

Holds what an install lands in a target, being `base.css` at its root and the target's own values under `project/`.

- A project's faces sit in `project/fonts/` with plain `@font-face` rules in `project/fonts.css`, which `canon design fonts add` writes and `project-fonts.ts` reads
- A project rule for a vendored family replaces the vendored face
- The synced `base.css` carries no `@font-face`, so a consumer embeds the faces it names at injection

### Other folders

The skills and docs around the module each own one slice.

- `claude/skills/design-record/` owns the record's standard and the reference folder's, and the steps that land a pick in `canon/design/` and carry its values into the record
- `claude/skills/design-taste/` owns the layer model, the coherence locks, and grey-boxing, and `governance/rules/ui/design-taste.md` routes stylesheet and `canon/DESIGN.md` edits to it
- `assets/brand/mark.svg` is the one authored icon, and the path data in `src/design/render.ts` and the README `mark-accent` pair are static copies nothing compares
- `examples/design/` owns an intent record for an invented project, with no committed capture
- `canon design --help` owns the `canon design` flags, and `docs/workflow/visual-design-workflow.md` the tier framework

## Gotchas

- `canon design regen` resolves outputs from `PROJECT_ROOT`, the installed package in a target, and refuses there rather than writing into `node_modules`
- The Typography table cannot hold the type steps, since `table()` in `src/design/parse.ts` reads every pipe row of a section as one table
- `src/design/base.css` is written flat by `regen` and wrapped at 80 columns by oxfmt, so a value that renders past that width fails the `design` stage on drift
- The `surface-capture` rule reads breakpoints from the record's `## Layout` as text, and the `capture widths` test in `src/design/css.test.ts` is its only check
- A code-span cell keeps its backticks in `design.css` and paints nothing, and a non-hex value such as `ANSI 33` emits no `style`, so write a color cell as a bare hex
