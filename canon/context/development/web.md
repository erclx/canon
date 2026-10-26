---
title: Web
description: The canon.erclx.dev landing page, its composition and build-time reads, the deploy and social card, and the pull request visual checks and baseline
---

# Web

## Overview

Owns `web/`, the Astro app behind the `canon.erclx.dev` landing page, and the images the page and the README carry. The page is one route of eleven beats. It ships to no target, so the application-code non-goal in `canon/REQUIREMENTS.md` does not reach it. Its figures derive from build-time reads, bar the three the footer calls drawn.

## Layout

### `web/src/`

Holds the page, built from components that read their figures through `lib/`.

- `pages/` assembles the one route, and `components/beats/` holds the eleven beats, one component each, so two builds on different beats touch different files
- `components/sections/` holds the fold, proof band, beat group, provenance ledger, install steps, field, and close
- `content/copy.ts` holds the page copy, each string cited to `README.md` or marked as a paraphrase, which `readmeCitations` in `src/gate/measures.ts` gates
- `lib/derive.ts` holds every read rule as a pure function, refusing a skill with no skill-map row and a row naming none, and `session.ts` spawns the CLI and reads files for it
- `styles/global.css` maps role names onto the generated `tokens.css` inside `@layer base`, and `base.astro` embeds Geist

### `web/`

Beside `src/`, holds the tests, the social card route, and the files served as they are.

- `e2e/` owns the Playwright suite, which runs on all three browsers
- `card-src/` owns the social card route, served by `card.config.mjs` as `bun run web:card` on 4421 plus `WORKTREE_PORT_OFFSET`
- `web:card:check` fails a build carrying `og-card-marker` or any `*og-card*` file, which is why the published card is `social-card.png`
- `public/assets/social-card.png` is a symlink into `assets/frames/`, and `public/evidence/` holds two fixed captures of one merged pull request
- `public/previews/` holds committed renders written only by `scripts/core/regen-web-previews.ts`, and `.oxfmtrc.jsonc` ignores the folder

### `assets/`

This repository's self-portrait for a visitor who never opens the source, where `examples/` is sample input for a reader about to copy and run it.

- `evidence/home/` is the committed baseline of the page, one folder per section holding a frame per theme at 320 and 1280 pixels
- `frames/` and `captures/` hold the card and hero images, and a render gates only where `captureStamps` makes something committed depend on it
- `merge/` and the whole-page frames come from a `workflow_dispatch` artifact on `main`, since a local capture falls back to another font
- Every README image ships as a `<name>` and `<name>-light` pair behind a `<picture>`

### `.github/workflows/`

Holds the two workflows that build and check the page.

- `deploy-site.yml` publishes the page, and `pr-visual-checks.yml` runs the e2e job and a capture job that reports into the job summary and commits nothing
- The two files carry literal copies of the same nine path globs, which the `visual-path-globs` stage compares, and the visual copy adds `tooling/web/configs/e2e/**` through `VISUAL_ONLY_GLOBS`

### Other folders

Two folders outside `web/` shape what the page renders and captures.

- `src/design/` owns the tokens `web/` reads, and `canon/context/features/design.md` covers it
- `scripts/core/regen-web-favicon.ts` writes `web/public/favicon.svg`, the mark on a tile, and the README `mark-color` pair, since an image has no CSS context and `currentColor` paints black
- The nav and the card inline the mark and color its pip from `FAVICON_COLORS`, never `--color-accent`
- `tooling/web/configs/e2e/` owns the screenshot harness, which creates its context with reduced motion and scrolls each section into view before it shoots

## Gotchas

- `lib/canon-cli.ts` and the `web:*` scripts run `bun src/cli.ts` rather than `canon` on PATH, so a worktree build never reads another checkout's catalogs
- `web/` has no `package.json` and sits outside the `types` stage, so `bun run web:build` through `astro check` is its only typecheck
- A root `src/` module importing through `@/` cannot load from a `web/` config, which aliases `@` to `web/src`, so the card route spells its `@font-face` itself
- The social card stamp digests the capture address, so an edit to `card-src`, `copy.ts`, the mark, or `FAVICON_COLORS` leaves the PNG stale until `bun run web:card` re-captures both themes
- A lazy `<img>` or `<iframe>` stays unloaded in a hand-written capture until scrolled into view, and `networkidle` does not re-arm, so wait on `readyState`
