---
name: design-extract
description: Drafts `canon/DESIGN.md` from a project's existing prose and shell UI surfaces, or proposes token values from `REQUIREMENTS.md` and a `## Personality` section when no UI code exists yet. Use when asked to "extract the design system", "draft DESIGN.md", "bootstrap design tokens", "capture the visual system", "propose a design system", "bootstrap DESIGN.md from scratch", "draft tokens for a greenfield project", or "replace Claude Design onboarding". Do NOT use to mutate an existing `canon/DESIGN.md`.
---

# Design extract

## Guards

- If `canon/DESIGN.md` already exists and has content beyond the seed template, stop: `❌ canon/DESIGN.md already populated. Edit directly or archive the existing file first.`
- If `canon` is not on PATH, stop: `❌ canon CLI not found.`

Step 1 carries two more stops that apply to one path only. Do not evaluate them before the path is picked.

## Step 1: pick the path from what the project already has

Check the project root for UI surfaces: `src/ui.ts`, `src/ui.tsx`, `src/components/**`, `scripts/lib/ui.sh`, and any `*.css`, `tailwind.config.*`, or `theme.*`.

- Any match takes the source path. Existing code defines the system, so every filled cell traces to a value already in the tree.
- No match takes the greenfield path. Nothing anchors a value there unless a picked reference does, so name `sketch-design` as the first move: a picked reference anchors a cell where a paragraph alone cannot. A direct run of this skill still falls through to the proposal-from-personality rules in Step 4, tag included, so this skill stays runnable on its own with nothing rendered yet.

The project decides this, never a user flag or an argument. Announce which path ran in one line before Step 2, since the two produce different-looking output from the same skill.

The greenfield path needs a personality paragraph to propose against, and stops without one. The source path needs neither file and skips both stops.

- If `canon/REQUIREMENTS.md` is missing, stop: `❌ canon/REQUIREMENTS.md not found. Write requirements before proposing a design system.`
- If `canon/REQUIREMENTS.md` has no `## Personality` section, stop: `❌ canon/REQUIREMENTS.md missing ## Personality section. Add a paragraph describing voice and tone before running this skill.`

## Step 2: read source signals in parallel

Read these on both paths, skipping any that do not exist:

- `CLAUDE.md`: voice and personality
- `canon/REQUIREMENTS.md`: the `## Personality` paragraph, worldview, non-goals
- `${CLAUDE_SKILL_DIR}/../../standards/markdown.md`: word, punctuation, and formatting constraints
- The `write-human` skill: tone and sentence construction constraints

On the source path, also read the UI surfaces matched in Step 1 plus `canon docs output-shape` and `canon docs index`, for output shape or framing rules already documented in the toolkit's own reference. Skip either that fails to resolve, since a project keeping its framing rules elsewhere is read there instead.

On the greenfield path, also read `canon/ARCHITECTURE.md` for platform, tech stack, and surface type. Do not scan `src/`, stylesheets, or UI modules. Step 1 already established they hold nothing.

On the greenfield path, also check `.canon/picks/*/design-handoff.md` for a file the `sketch-design` skill wrote, taking the most recently modified match when more than one exists. Read it when found. Its presence is what Step 4 traces cells from instead of proposing them.

Run these reads in parallel. Do not speculatively recurse into every directory.

## Step 3: fetch the seed template

Run this from the project root:

```bash
canon claude seeds list --json | jq -r '.[] | select(.path == "canon/DESIGN.md") | .content'
```

Use the returned content as the target shape. Keep every section heading and every table header intact. The `canon design render` parser depends on them.

## Step 4: fill the template

Walk each section once. Follow `${CLAUDE_SKILL_DIR}/../../standards/markdown.md` for punctuation and word choice throughout: no em dashes, no semicolons, no marketing buzzwords. Use commas or separate sentences instead.

Mark any cell not traced to a source value by appending ` ? verify` inside the cell value, never as a trailing column. The cell stays inside the table shape: `| #ffffff ? verify |`. A trailing `| ? verify` after the row breaks the parser. A prose section takes its uncertainty inline instead, for example `Proposed 150ms ease-out, not yet confirmed.`, because a trailing tag on a sentence renders raw in the preview.

On the source path, the tag marks the exception. On the greenfield path it marks nearly every cell, since the values are speculative until code or a designer anchors them.

### Source path

- **Personality**: one paragraph. Transcribe what `CLAUDE.md` and `canon/REQUIREMENTS.md` say about voice, tone, and visual feeling. Do not invent rules the source does not state. If nothing matches, write a one-sentence placeholder ending in `? verify`.
- **Color**: one row per role. Source hex values from the CLI UI files or stylesheets. If a role has no source signal, leave `Value` blank rather than guessing.
- **Typography**: one row per role. Source families and sizes from stylesheet or theme config. Leave cells blank when no signal exists.
- **Spacing**: fill the base unit and multipliers from stylesheet tokens or obvious repeated values in the UI code.
- **Borders**: one row per role. Source from stylesheet or CSS variables.
- **Motion** and **Iconography**: one line each. Default to `No animation.` and `No custom icons.` when no evidence exists.

### Greenfield path

Anchor every proposal to a signal, never to a default. "Calm and dense" pins muted grays and tight spacing. A requirements non-goal of "no motion" makes Motion read `No animation.` with no tag. A CLI-only surface leans Typography monospaced and keeps Borders minimal.

- **Traced cells**: when Step 2 matched a `design-handoff.md` file, fill only the fields it actually states, no tag, the same traced-versus-proposed distinction the source path draws for a stylesheet value.
- The handoff carries hex and family and size, never Weight, Line height, or a color's Intent. Those cells, every field of a role the handoff never names, and Motion and Iconography regardless, still follow the proposal rules below, tag included.
- **Personality**: transcribe the `## Personality` paragraph from `canon/REQUIREMENTS.md` verbatim. This is the one section that is not a proposal. No tag.
- **Color**: one row per role. Rewrite the Intent cell in personality language, for example `warm off-white page canvas` instead of the seed default `page canvas`. Propose hex values matching the personality. Dense and calm gives low saturation and high text contrast. Playful gives saturated accents. Every Intent and Value cell gets `? verify`.
- **Typography**: one row per role. Propose families fitting the platform, system UI for web, monospaced for CLI tools, serif for editorial, and a harmonious scale. Every cell gets `? verify`.
- **Spacing**: propose a base unit matching density intent. Dense gives a 4px base, roomy gives 8px. Keep the Multiplier column as the seed ships it, no tag. Only the Value column gets `? verify`.
- **Borders**: propose radius and width per role. Sharp and technical gives a small radius, soft gives a larger one. Every Radius and Width cell gets `? verify`.
- **Motion**: one line. Write `No animation.` when the requirements forbid motion. Otherwise phrase the uncertainty inline.
- **Iconography**: one line. Propose style and source library matching personality, phrasing the uncertainty inline.

Do not invent non-goals. A proposed motion line is fine when neither the personality paragraph nor the requirements rule motion out.

## Step 5: write and render

Write the filled template to `canon/DESIGN.md` from the project root. Then run:

```bash
canon design render
```

The command writes an HTML plus CSS preview to `.canon/tmp/render/design/`. Output the path in chat so the user can open it.

## Response format

```plaintext
📝 Wrote canon/DESIGN.md
📝 Wrote .canon/tmp/render/design/index.html

Ran the <source|greenfield> path. N cells marked `? verify`. Open the preview and confirm before committing.
```
