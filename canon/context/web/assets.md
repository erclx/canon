---
title: Assets and previews
description: The social card route and its exclusion check, the favicon, the evidence beat's fixed captures, the build-time previews, the README images, and why assets and examples are separate folders
---

# Assets and previews

## Overview

Every image and embedded render the landing page and the README carry, and the folders they come from. `canon/context/web/capture.md` covers the captures of the page itself.

## Layout

- `web/public/assets/` owns `social-card.png`, the `og:image`, symlinked from the repository's own `assets/evidence/`
- `web/public/evidence/` owns the two fixed captures of one pull request the evidence beat shows
- `web/public/previews/` owns build-time renders embedded as `<iframe>` sources, being `design-tokens/` and `teach-workspace/`
- `web/card-src/` owns the social card route, served by `web/card.config.mjs`

## Decisions

### Assets and examples are separate folders

`assets/` and `examples/` both hold a hand-authored source, a render step, and output, so a source-against-output rule cannot separate them and sorts within `assets/` instead. What separates the two folders is the reader: `assets/` is this repository's self-portrait for a visitor who never opens the source, and `examples/` is sample input for a reader about to copy and run it. A render gates only when something else committed depends on it staying current, which is `assets/`'s case through `captureStamps` and not `examples/`'s.

### The social card

The social card is a `draft-identity` composition: the mark on a tile in `FAVICON_COLORS`, the name, `site.tagline`, and an `Eric Le · canon.erclx.dev` byline, matching the operator's other project cards. The hero frame is drawn to be read at page size rather than at thumbnail size, so it is not the card. The dark capture ships as `og:image` with `og:image:width`, `height`, and `alt`, and `social-card-light.png` sits beside it for a place that picks its own image.

`web/public/assets/social-card.png` is a symlink into `assets/evidence/`, not a copy, so one image has one source. The Windows-checkout cost, a plain-text path with no build error, is recorded in `canon/context/tooling/stacks.md`. `assets/evidence/hero.png` stays committed, owned by `regen-hero.sh` and the capture-stamp gate, though no page cites it.

The card route and its config are copied from the `astro` stack rather than synced, since `canon tooling sync astro web --write` would overwrite every other golden config under `web/`. `bun run web:card` serves it on 4421 plus `WORKTREE_PORT_OFFSET`. The route differs from the stack copy in three ways: it emits the Geist face itself, reads the mark, copy, and `FAVICON_COLORS` from their sources, and takes `?theme=light`. The config turns the Astro dev toolbar off, since it paints over the viewport `canon capture` cuts the card from.

`bun run web:card:check` runs `tooling/astro/configs/scripts/check-card-exclusion.sh` in place with `PROJECT_ROOT=web`, in `deploy-site.yml` and `pr-visual-checks.yml` right after the gallery check. It fails a build carrying the route's `og-card-marker` meta tag or any file named `*og-card*`, which is why the published card is `social-card.png` rather than a name taken from the route.

### The favicon

`web/public/favicon.svg` is written by `scripts/core/regen-web-favicon.ts` from `assets/brand/mark.svg` and the favicon's own two colors in `src/design/favicon.ts`, which read no page token, rather than symlinked the way `social-card.png` is. The source keeps `currentColor` because the nav embeds the same mark inline and wants it to inherit, and a favicon loads with no CSS context, so a symlinked source would paint the tab icon pure black on every surface.

### The evidence beat's captures

The two captures under `web/public/evidence/pr-1699/` are fixed renders of one pull request's merge base and head, by `canon design render` at one viewport and one crop. Both commits are history, so no script regenerates them, and the caption says how they were made. A window mockup drawn from boxes was the alternative, and two real captures of one change answer the question with more force.

### Build-time previews

`bun run web:build` runs `web:previews`, which is `scripts/core/regen-web-previews.ts`, between `web:favicon` and `astro build`. It writes `web/public/previews/<name>/{index.html,design.css}`, committed rather than gitignored, and the merge beat embeds the design-token render live through an `<iframe>` as the change that session merged. The `teach-workspace` render is written and embedded nowhere, since the page carries the session and nothing else.

The `teach-workspace` preview copies only rendered HTML and CSS, never a workspace's own `MISSION.md`, `RESOURCES.md`, or `GLOSSARY.md`, whose links are relative to `.canon/teach/` and resolve to nothing once copied under `web/public/`. It skips the whole regeneration when `.canon/teach/<slug>` is absent, since that folder is gitignored session scratch and no CI machine has it.

### README images

The README carries three images: the mark, the install frame, and `demos/agent-view.gif`. Stills of the landing page's first screen, the catalog ledger, a slide, and the teach listing are left out, because two stated different counts for the same catalogs and the first duplicated the recording's opening frame. The deck and the teach workspace are reached through the `Teach` and `Slides` rows of the domain table.

Every README image ships as a `<name>` and `<name>-light` pair behind a `<picture>` on `prefers-color-scheme`. The gif stays dark, clicks `.theme-toggle` in its second beat, and is recorded against `#dispatch` and `#workers`. `assets/brand/mark-accent.svg` and `mark-accent-light.svg` bake each accent in, because `mark.svg` uses `currentColor` and renders black inside an `<img>`. `assets/evidence/arrival.png` stays committed and is retaken by hand in dark mode when the first screen changes, since it has no template, though no README shows it.

## Gotchas

- The social card's stamp digests the capture address, not the page, so an edit to `web/card-src/pages/og-card.astro`, to `site` in `copy.ts`, to `assets/brand/mark.svg`, or to `FAVICON_COLORS` leaves the committed PNG stale with every check green. Re-capture both themes through `bun run web:card` after any of them: `canon capture http://127.0.0.1:<port>/og-card --selector .card --out assets/evidence/social-card.png`, and again with `?theme=light` into `social-card-light.png`.
- A design-token change moves the capture markup and the stamps and leaves the PNGs byte-identical, because the frames render on the dark ground and never set `data-theme`. The Hero stage is a drift check over `assets/captures/*.html`, so it fails until the regenerated frames are committed, which is the stage working rather than a defect.
