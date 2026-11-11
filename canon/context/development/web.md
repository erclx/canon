---
title: Web
description: The canon.erclx.com landing page, its composition and build-time reads, the deploy and social card, and the pull request visual checks and baseline
---

# Web

## Overview

Owns `web/`, the Astro app behind the `canon.erclx.com` landing page, and the images the page and the README carry. The page is one route of eight sections, from Claude Code's agent view down to the install. It ships to no target, so the application-code non-goal in `canon/REQUIREMENTS.md` does not reach it.

## Layout

### `web/src/`

Holds the page, built from components that read their figures through `lib/`. A section sheet sits under its id, since its script writes markup a scoped style never reaches, and the nav and footer sheets sit under their root class. `components/markup.test.ts` fails on a style block, a script body, or SVG written inline.

- `components/` holds a folder per section, plus `site-nav/` and `site-footer/`, each splitting `index.astro` from its `style.css`, `client.ts`, and icons, which `pages/` assembles into one route
- `content/copy.ts` holds the copy and the product views' scenes, each string cited to `README.md` or marked as a paraphrase, gated by `readmeCitations`
- `content/` also holds the sessions, craft's practices with each quote's ledger row, and the record sheets under `content/records/`, one formatted HTML file each
- `lib/skills.ts` reads the skill catalog for the opening's `/` menu, and `lib/scene.ts` paces every scene window, halting it while the reader holds it
- `styles/global.css` imports Tailwind first, then maps role names onto `tokens.css` in `@layer base` beside the shared tray, window, and picker classes, and `base.astro` embeds Geist and Geist Mono

### `web/`

Beside `src/`, holds the tests, the social card route, and the files served as they are.

- `e2e/` owns the Playwright suite, which runs on all three browsers
- `card-src/` owns the social card route, served by `card.config.mjs` as `bun run web:card` on 4421 plus `WORKTREE_PORT_OFFSET`
- `web:card:check` runs the shipped exclusion check, which fails a build carrying `og-card-marker` or a built page under an `og-card` path and passes an image of that name
- `public/og-image.png` is a symlink to the social card in `assets/frames/`, which the site serves at its root
- `public/previews/` holds committed renders written only by `scripts/core/regen-web-previews.ts`, and `.oxfmtrc.jsonc` ignores the folder

### `assets/`

This repository's self-portrait for a visitor who never opens the source, where `examples/` is sample input for a reader about to copy and run it.

- `evidence/home/` is the committed baseline of the page, one folder per section holding a frame per theme at 320 and 1280 pixels
- `frames/` holds the social card and its stamp, the one image the site's link preview shows
- `loops/` holds the README's `readme` pair, taken by hand from the page's opening, beside the launch film's GIFs, MP4s, and posters, which `bun run film:render` writes and the page no longer plays
- `merge/` and the whole-page frames come from a `workflow_dispatch` artifact on `main`, since a local capture falls back to another font
- Every README image ships as a `<name>` and `<name>-light` pair behind a `<picture>`

### `.github/workflows/`

Holds the two workflows that build and check the page.

- `deploy-site.yml` publishes the page, and `pr-visual-checks.yml` runs the e2e job and a capture job that reports into the job summary and commits nothing
- The two files carry literal copies of the same path globs, which the `visual-path-globs` stage compares
- The visual copy adds `tooling/web/configs/e2e/**` and `.htmlvalidate.cjs` through `VISUAL_ONLY_GLOBS`
- Both lists hold `web/**`, `assets/**` minus `assets/evidence/**`, `src/design/**`, and the deploy workflow file
- The catalogs (`claude/skills/`, `governance/rules/`, the skill map) are out of both lists because the page reads none at build time, so add one back in the change that makes it read one

### `.htmlvalidate.cjs`

Holds the `html-validate` rules for the built page, and `.htmlvalidate-records.cjs` extends it for the record sheets.

- `check:lint` lints `web/src/content/records/*.html` through `.htmlvalidate-records.cjs`, which demands the self-closing form oxfmt writes
- The `pr-visual-checks.yml` e2e job lints the built `web/dist/index.html` through `.htmlvalidate.cjs`, so the page is linted only after a build
- Each rule set to `off` in `.htmlvalidate.cjs` carries its reason beside it, and the `h3` inside the setup section's stage buttons is a real defect left standing until the section markup stops moving
- `canon/design/**/*.html` is exempt, since Frameboard's sync writes the board's markup and its `--check` compares the bytes, so a fix belongs in Frameboard

### Other folders

Two folders outside `web/` shape what the page renders and captures.

- `src/design/` owns the tokens `web/` reads, and `canon/context/features/design.md` covers it
- `scripts/core/regen-web-favicon.ts` writes `web/public/favicon.svg`, the mark on a tile, and the README `mark-color` pair, since an image has no CSS context and `currentColor` paints black
- The nav and the card inline the mark and color its pip from `FAVICON_COLORS`, never `--color-accent`
- `tooling/web/configs/e2e/` owns the screenshot harness, which shoots each section with reduced motion, and `css.test.ts` pins its widths to the record's Layout line in `src/design/tokens.ts`

## Gotchas

- `lib/canon-cli.ts` and the `web:*` scripts run `bun src/cli.ts` rather than `canon` on PATH, so a worktree build never reads another checkout's catalogs
- `web/` has no `package.json` and sits outside the `types` stage, so `bun run web:build` through `astro check` is its only typecheck
- A root `src/` module importing through `@/` cannot load from a `web/` config, which aliases `@` to `web/src`, so the card route spells its `@font-face` itself
- The social card stamp digests the capture address, so an edit to `card-src`, `copy.ts`, the mark, or `FAVICON_COLORS` leaves the PNG stale until `bun run web:card` re-captures both themes
- A lazy `<img>` or `<iframe>` stays unloaded in a hand-written capture until scrolled into view, and `networkidle` does not re-arm, so wait on `readyState`
