---
title: Extract skill
description: The design-extract skill's source and greenfield paths, why one skill picks its path from the tree, the seed shape it fills, and the sandbox scenario picker
---

# Extract skill

## Overview

`canon:design-extract` drafts `canon/DESIGN.md` and picks one of two paths from what the project has. Both read `CLAUDE.md`, `canon/REQUIREMENTS.md`, and `standards/markdown.md`, load the `write-human` skill for tone, fill the same seed, and end at the same render. Install it in a target through `canon claude install` and invoke it with `/canon:design-extract`.

## Decisions

- One skill covers both paths. They shared a seed, a render pipeline, and two byte-identical steps, and a split cost a caller a choice the project already answers.
- The skill picks its path from whether UI code exists, never from a flag. The ban on dispatch flags in `standards/skill.md` targets a toggle the model reads and misapplies, and a test against the tree has no such failure.
- Switching paths later is a rewrite of `DESIGN.md`, not a migration.
- The skill is judgment-driven rather than deterministic. It does not parse CSS or compiled styles, and it codifies what the project already says about itself. For extraction from raw compiled code, reach for Claude Design instead.

## Gotchas

- The greenfield path tags nearly every cell, so the confidence count there reads near-total uncertainty. That is the path reporting itself accurately rather than a defect in the record.

## The two paths

The source path runs when the project has UI code. It reads CLI UI modules like `src/ui.ts` or `scripts/lib/ui.sh` plus any stylesheet or theme config, sources values from them, and tags an inferred cell with a trailing `? verify`. `standards/design.md` specifies that tag, its two spellings, and what the renderer does with it.

The greenfield path runs when nothing matches. It requires a `## Personality` paragraph in `canon/REQUIREMENTS.md`, reads `canon/ARCHITECTURE.md` for platform signals, and proposes token values from those inputs. Nearly every cell carries `? verify`, since the values are speculative until code or a designer anchors them. This path avoids the Claude Design onboarding quota for a greenfield project, and a first render commonly shifts several tokens after review.

## Seed shape

The seed at `tooling/claude/seeds/canon/DESIGN.md` defines the target structure:

- **Personality**, one paragraph describing voice and tone
- **Color**, a table with `Role | Intent | Value` rows covering background, surface, text, muted, accent, success, warning, and error
- **Typography**, a table with `Role | Family | Weight | Size | Line height` rows covering display, heading, body, label, and code
- **Spacing**, a table with `Step | Multiplier | Value` rows covering xs through xl
- **Borders**, a table with `Role | Radius | Width | When used` rows
- **Motion**, one line on whether motion is used
- **Iconography**, one line on icon style and source

Table headers are load-bearing. The `canon design render` parser matches columns by header name, so keep them intact during edits.

## Sandbox scenario

`design-extract.sh` covers both paths through `select_or_route_scenario`, picking between `source`, which stages the tokenized notes app, and `greenfield`, which stages a focus timer with a `## Personality` paragraph and no code. `source` is listed first, so a caller routing past the picker lands on that path.
