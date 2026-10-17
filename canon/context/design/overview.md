---
title: Overview
description: What the domain owns, the generated record against a target's authored one, the neutral base, and the workflow
---

# Overview

## Overview

`canon/DESIGN.md` holds visual intent, being a one-paragraph Overview, a few one-line rules per section, and a table naming what each color and shape role is for. A target's record carries no value, and its lead names the stylesheet the values live in. A CLI command renders a token preview of a record that does carry values.

This repository's own record is generated rather than authored.

- `canon design regen` renders it from `src/design/tokens.ts`, and renders `src/design/base.css` from the achromatic set in `src/design/neutral.ts`
- The `design` gate stage asserts both for drift
- The same stage counts this record and `examples/design/DESIGN.md` against the prose budget in `claude/skills/canvas-board/references/design.md`, through `src/design/budget.ts`

### Target records

A target keeps the hand-authored shape, so the markdown parser serves that reader. It reads `## Personality`, `## Color`, and `## Borders` as `## Overview`, `## Colors`, and `## Shapes` for good, since a record written before the rename will not rename itself.

## Layout

- `src/design/` owns the token module, the component layer, the renderers, the markdown parser, the sync adapter, and the contrast reading
- `claude/skills/canvas-board/` owns the step that carries a picked direction into the file
- `claude/skills/design-taste/` owns the layer model, the coherence locks, and grey-boxing
- `.canon/tmp/render/design/` owns the rendered preview, gitignored
- `.claude/design/` owns what an install lands in a target, `base.css` at its root and the target's values under `project/`

`governance/rules/ui/design-taste.md` routes stylesheet and `canon/DESIGN.md` edits to `design-taste`. Building an already-decided surface stays outside its glob, so a project styling in utility classes is not reached.

`canon/context/design/tokens.md` covers the token module and the surfaces reading it, and `canon/context/design/render.md` the preview. The canvas where a direction is drafted is `canon/context/features/canvas.md`.

### Workflow

A direction nobody has settled is drafted on the canvas first, through `canvas-board`. Only the pick leaves it, its values for the stylesheet and its intent for `DESIGN.md`.

1. Draft `canon/DESIGN.md` from the seed template and name the project's stylesheet in its lead, or carry in a pick from the canvas.
2. Write each value into that stylesheet, and the rule or intent behind it into the record.
3. For a record carrying values, review the `? verify` cells through `canon design render`, which marks and counts each one at `.canon/tmp/render/design/index.html`.

### Related

Two docs carry the contract and the tiers around this domain.

- `docs/agents/commands.md`: CLI flags and invocation contract for `canon design`
- `docs/workflow/visual-design-workflow.md`: tier framework for prose-only, visual companion, and graphical source of truth

## Decisions

### The record stays at the canon root

`canon/DESIGN.md` sits beside `REQUIREMENTS.md`, with no `canon/design/` folder around it. Moving it would change a path the surface root, the migrations, and the renderer all read, for a tidier root alone.

### Output is one-way

`DESIGN.md` is source and the preview is derived. The renderer never mutates a target's stylesheets, and it regenerates on demand rather than on save.

### The toolkit's record renders from a module

A table a person edits is one a parser must be taught to read back, where a module is checked by the compiler. The cost is two artifacts from one source, and only the `design` gate stage catches them disagreeing.

The module's prose slots are rule lists, so a bullet is the unit the renderer emits and the budget counts. A paragraph of why goes to `canon/context/design/tokens.md`.

### A target's record holds intent and points at the stylesheet

A target writes rules, omissions, and each role's intent by hand, and takes every value from its stylesheet. Hand-typed hex tables are a second copy of the CSS that drifts with nothing to catch it.

- Each role row names its custom property, such as `--color-accent`, so a role can still be matched against the stylesheet
- The three renamed headings follow Google's DESIGN.md where it maps, and `## Layout` keeps its name because the surface-capture rule reads breakpoints from it
- The worked example points at its invented project's stylesheet and ships none, so its render capture went with its values

### A target inherits a neutral base

`canon design install` ships greys at chroma 0 and a monochrome accent, keeping only the two success greens, since a state color is a meaning rather than a palette. Rewording the seed's examples alone would leave every installed target rendering this repository's red.

The cost is a second color list the `design` gate stage cannot compare against `TOKENS`. The role parity test in `src/design/neutral.test.ts` stands in for that comparison.

## Gotchas

- `canon design regen` resolves outputs from `PROJECT_ROOT`, the installed package directory in a target. It refuses where `.claude/DESIGN.md` is absent there, rather than writing into `node_modules`.
