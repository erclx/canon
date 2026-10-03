---
title: Overview
description: What the design domain owns, the generated record against a target's authored one, the neutral base a target inherits, and the design workflow
---

# Overview

## Overview

`canon/DESIGN.md` holds visual intent as token tables, a one-paragraph Personality, and a few one-line rules per section. The toolkit treats it as the tool-agnostic source of truth for any project's design system. A Claude Code skill drafts the file from existing project signals, and a CLI command renders a token preview for human inspection.

This repository's own record is generated rather than authored. `src/design/tokens.ts` holds the values, and `canon design regen` renders the record from it and `src/design/base.css` from the achromatic set in `src/design/neutral.ts`, both of which the `design` gate stage asserts for drift. The same stage counts this record and `examples/design/DESIGN.md` against the prose budget `standards/design.md` sets, through `src/design/budget.ts`. A target keeps the hand-authored shape, so the markdown parser serves that reader and this repository reads the module instead.

## Layout

- `src/design/` owns the token module, the component layer, the record and stylesheet renderers, the markdown parser and preview renderer, the sync adapter, and the contrast reading
- `claude/skills/design-extract/` owns the skill that drafts the file, from an existing codebase or from a greenfield project
- `claude/skills/design-taste/` owns the layer model, the coherence locks, and grey-boxing, and `governance/rules/ui/460-design-taste.md` routes stylesheet and `canon/DESIGN.md` edits to it. Building an already-decided surface stays outside the glob, so a project styling entirely in utility classes is not reached
- `.canon/tmp/render/design/` owns the rendered preview, gitignored
- `.claude/design/` owns what an install lands in a target, `base.css` at its root and the target's own values under `project/`

`canon/context/design/tokens.md` covers the token module and the surfaces reading it, `canon/context/design/extract.md` the extract skill and the seed shape, and `canon/context/design/render.md` the preview. The canvas a direction is drafted on before it reaches this record is `canon/context/features/canvas.md`.

## Decisions

### Output is one-way

`DESIGN.md` is source and the preview is a derived artifact. The renderer does not mutate target-project stylesheets, and it regenerates on demand rather than on save.

### The toolkit's record renders from a module

The toolkit's own record is rendered from `src/design/tokens.ts` rather than authored. Leaving the document as the source was the alternative, and it costs more: a table a person edits is one a parser has to be taught to read back, where a module is checked by the compiler. The cost is two artifacts from one source, and the `design` gate stage is the only thing that catches them disagreeing. The module's prose slots are rule lists rather than strings, so a bullet is the unit the renderer emits and the budget counts, and a paragraph of why goes to `canon/context/design/tokens.md`.

### A target inherits a neutral base

`canon design install` ships greys at chroma 0 and a monochrome accent, keeping only the two success greens, since a state color is a meaning rather than a palette. Rewording the seed and the extract skill's examples alone was the alternative, and it leaves every installed target rendering this repository's red. The cost is a second color list the `design` gate stage cannot compare against `TOKENS`, which the role parity test in `src/design/neutral.test.ts` stands in for.

## Gotchas

- `canon design regen` resolves its outputs from `PROJECT_ROOT`, which is the installed package directory in a target. It refuses where `.claude/DESIGN.md` is absent at that root, which is what an installed package looks like, rather than writing two files into `node_modules` and reporting success.

## Workflow

1. Run the extract skill to draft `canon/DESIGN.md`. It sources tokens from an existing codebase, or proposes them against a greenfield project with a personality paragraph.
2. Review the `? verify` cells and edit the file directly. The preview marks each one and counts them, so the preview is where they are found rather than the source file.
3. Run `canon design render` to regenerate the preview
4. Open `.canon/tmp/render/design/index.html` in a browser
5. Iterate on `DESIGN.md` until the preview matches intent

A direction nobody has settled yet is drafted on the canvas first, through the `canvas` skill, and only the pick is carried into `DESIGN.md`.

## Related

- `docs/agents/commands.md`: CLI flags and invocation contract for `canon design`
- `docs/workflow/visual-design-workflow.md`: tier framework for prose-only, visual companion, and graphical source of truth
