---
title: Assets and previews
description: The social card route and its exclusion check, the favicon, the previews, the README images, and why assets and examples are separate folders
---

# Assets and previews

## Overview

Every image and embedded render the landing page and the README carry, and the folders they come from. `canon/context/web/capture.md` covers the captures of the page itself.

## Layout

- `web/public/assets/` owns `social-card.png`, the `og:image`, symlinked from `assets/frames/`, which sits outside the dev evidence folder `canon/context/development/evidence.md` describes
- `web/public/evidence/` owns the two fixed captures of one pull request the evidence beat shows, prod evidence by the boundary that entry states
- `web/public/previews/` owns build-time renders embedded as `<iframe>` sources, `design-tokens/` and `teach-workspace/`
- `web/card-src/` owns the social card route, served by `web/card.config.mjs`

## Decisions

### Assets and examples are separate folders

`assets/` and `examples/` both hold a hand-authored source, a render step, and output, so a source-against-output rule cannot separate them. The reader does.

- `assets/` is this repository's self-portrait for a visitor who never opens the source
- `examples/` is sample input for a reader about to copy and run it
- A render gates only when something else committed depends on it staying current, which is `assets/`'s case through `captureStamps` and not `examples/`'s

### The social card

The card is a `draft-identity` composition of the mark on a tile in `FAVICON_COLORS`, the name, `site.tagline`, and an `Eric Le · canon.erclx.dev` byline, matching the operator's other project cards. The hero frame is drawn to read at page size, so it is not the card.

- The dark capture ships as `og:image` with `og:image:width`, `height`, and `alt`, and `social-card-light.png` sits beside it for a place that picks its own image
- `web/public/assets/social-card.png` is a symlink into `assets/frames/`, not a copy, so one image has one source. The Windows-checkout cost is recorded in `canon/context/tooling/stacks.md`.
- `assets/frames/hero.png` stays committed, owned by `regen-hero.ts` and the capture-stamp gate, though no page cites it

### The card route is copied, not synced

The route and its config are copied from the `astro` stack, since `canon tooling sync astro web --write` would overwrite every other golden config under `web/`. `bun run web:card` serves it on 4421 plus `WORKTREE_PORT_OFFSET`.

- It emits the Geist face itself
- It reads the mark, copy, and `FAVICON_COLORS` from their sources
- It takes `?theme=light`
- The config turns the Astro dev toolbar off, since it paints over the viewport `canon capture` cuts the card from

### The card exclusion check

`bun run web:card:check` runs `tooling/astro/configs/scripts/check-card-exclusion.sh` in place with `PROJECT_ROOT=web`. `deploy-site.yml` and `pr-visual-checks.yml` run it right after the page build.

It fails a build carrying the route's `og-card-marker` meta tag or any file named `*og-card*`, which is why the published card is `social-card.png` rather than a name taken from the route.

### The favicon

`scripts/core/regen-web-favicon.ts` writes `web/public/favicon.svg` from `assets/brand/mark.svg` and the favicon's own two colors in `src/design/favicon.ts`, which read no page token. It is not symlinked the way `social-card.png` is.

The source keeps `currentColor` because the nav embeds the same mark inline and wants it to inherit. A favicon loads with no CSS context, so a symlinked source would paint the tab icon pure black on every surface.

### The evidence beat's captures

The two captures under `web/public/evidence/pr-1699/` are fixed renders of one pull request's merge base and head, by `canon design render` at one viewport and one crop. Both commits are history, so no script regenerates them, and the caption says how they were made.

A window mockup drawn from boxes would answer less forcefully than two real captures of one change.

### Build-time previews

`bun run web:build` runs `web:previews`, which is `scripts/core/regen-web-previews.ts`, between `web:favicon` and `astro build`. It writes `web/public/previews/<name>/{index.html,design.css}`, committed rather than gitignored.

- The merge beat embeds the design-token render live through an `<iframe>` as the change that session merged
- The `teach-workspace` render is written and embedded nowhere, since the page carries the session and nothing else
- The folder is in the `ignorePatterns` of `.oxfmtrc.jsonc` and carries no format gate, so the script is its only writer
- A formatter over the same files left `web:build` and `bun run check` each producing a file the other disagreed with

The `teach-workspace` preview copies only rendered HTML and CSS, never a workspace's `MISSION.md`, `RESOURCES.md`, or `GLOSSARY.md`, whose links are relative to `.canon/teach/` and resolve to nothing under `web/public/`. It skips the whole regeneration when `.canon/teach/<slug>` is absent, since that folder is gitignored scratch no CI machine has.

### README images

The README carries three images: the mark, the install frame, and `demos/agent-view/demo.gif`. Stills of the first screen, the catalog ledger, a slide, and the teach listing are left out, because two stated different counts for the same catalogs and the first duplicated the recording's opening frame.

The deck and the teach workspace are reached through the `Teach` and `Slides` rows of the domain table.

- Every image ships as a `<name>` and `<name>-light` pair behind a `<picture>` on `prefers-color-scheme`
- The gif stays dark, clicks `.theme-toggle` in its second beat, and is recorded against `#dispatch` and `#workers`
- `assets/brand/mark-accent.svg` and `mark-accent-light.svg` bake each accent in, because `mark.svg` uses `currentColor` and renders black inside an `<img>`
- `assets/frames/arrival.png` has no template and no README shows it, so it is retaken by hand in dark mode when the first screen changes

## Gotchas

### The card stamp digests the address

The social card's stamp digests the capture address, not the page. An edit to `web/card-src/pages/og-card.astro`, to `site` in `copy.ts`, to `assets/brand/mark.svg`, or to `FAVICON_COLORS` leaves the committed PNG stale with every check green.

Re-capture both themes through `bun run web:card` after any of them.

```bash
canon capture http://127.0.0.1:<port>/og-card --selector .card --out assets/frames/social-card.png
canon capture "http://127.0.0.1:<port>/og-card?theme=light" --selector .card --out assets/frames/social-card-light.png
```

### Token changes move the markup, not the PNGs

A design-token change moves the capture markup and the stamps and leaves the PNGs byte-identical, because the frames render on the dark ground and never set `data-theme`. The Hero stage is a drift check over `assets/captures/*.html`, so it fails until the regenerated frames are committed. That is the stage working, not a defect.
