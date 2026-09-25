---
title: Board
description: The canon design board page set, how it resolves its root and detects the toolkit checkout, the six panels and what each reads, and the component gallery build with its exclusion guard
---

# Board

## Overview

`canon design board` generates a static page set into a gitignored record folder, defaulting to `.canon/tmp/render/board/` through `creationRel`, and reports the path a reader opens with `canon serve`. `src/design/board.ts` writes it, following `src/teach/workspace.ts`'s shape of TypeScript emitting self-contained HTML with no framework and no build step. `WIREFRAME_DIR` there is the one named site a move of the wireframe corpus's root retargets.

## Decisions

### Repository-local, never installed

The board is never installed or synced. It is measured against the one project rich enough to fill it, and a target that installs every domain receives no board. The generator is the directory's only writer, so `canon serve` and a later `canon capture` pass both read the result without assuming it exists ahead of a run.

### Root and checkout detection

The board reads from a caller-resolved `--root`, defaulting through `mainWorktreeRoot()` to the main worktree the way `canon teach`'s verbs resolve theirs, rather than from `PROJECT_ROOT`. `generateBoard` takes an `isToolkitCheckout` boolean the CLI layer computes through `isOwnCheckout(root)` from `@/project-root`. A panel comparing the constant internally would send every unit test, which passes a throwaway tmp directory as `root`, down the not-toolkit branch.

`isOwnCheckout` reads `root`'s own `package.json` name rather than comparing the path against `PROJECT_ROOT`, since the CLI's `PROJECT_ROOT` is a linked worktree's path when a worker runs the board from inside one. It gates the surfaces panel's landing-page half and the whole components panel, both of which read this repository's build output. The command still carries `checkoutMismatchWarning`, since `.claude/`, `.canon/`, and `web/` are absent from the published package's `files` list.

### The panels

Each panel reads a source that already exists on disk and reports an absent one rather than rendering a broken frame.

- Tokens calls `renderDesignDoc` against `surfaceDir(root, 'DESIGN.md')` rather than building a second renderer
- Surfaces copies `web/dist` and `.canon/teach/` whole into the board's tree and iframes each, reporting a missing build, an absent workspace, or, for the landing-page half outside this toolkit's checkout, a toolkit-only notice
- Wireframes reads every `**/*.md` under `surfaceDir(root, 'wireframes')`, excluding `index.md` at any depth, and renders each file as-is inside a `<pre>`, since `standards/wireframes.md` makes the ASCII proportions load-bearing. Each label comes from the file's `description` through `@/indexes/frontmatter`
- Past candidates lists an arm capture under `.canon/picks/` per folder, stepping over `references/`
- Components copies `web/gallery-dist` the way surfaces copies `web/dist`
- References lists whatever image an operator dropped flat under `.canon/picks/references/`, through the same `imagesIn` helper, with no fetching

`surfaceDir` from `@/surface-root` is what lets tokens and wireframes reach a target that has not run `canon migrate surface-roots`, the same `.claude/` or `canon/` fallback `recordDir` gives the surfaces panel's teach half.

The header names `canon:draft-and-pick` as the drafting owner and `canon:ux-audit` as the auditing owner in one static line rather than a control, since a static page cannot invoke a skill.

### The component gallery

`web/gallery.config.mjs` is a second Astro config whose `srcDir` points at `web/gallery-src` and whose `outDir` is `web/gallery-dist`, run through `bun run web:gallery`. `web/gallery-src/pages/index.astro` imports every component under `web/src/components/` and renders each in a labeled section, except `panel-group` and `panel-row`, whose props carry no defaults and render as a named notice instead of invented data.

The exclusion is structural rather than a filename convention: `web:build`'s config never reads `gallery-src`, so a published build emits no gallery route. Astro's underscore-prefix convention was the alternative, and an underscore-excluded page emits no output for the board to read either.

`scripts/core/check-gallery-exclusion.sh` keeps that exclusion checked on every build rather than proven once, running in `deploy-site.yml` and `pr-visual-checks.yml` right after `bun run web:build` and `bun run web:gallery`. It greps for a fixed `canon-gallery-marker` meta tag rather than the page's prose, and asserts the marker survives inside `web/gallery-dist` before checking `web/dist`, so a rewritten notice fails there instead of disarming the leak check.
