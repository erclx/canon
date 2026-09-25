---
title: Build and deploy
description: The landing page's build-time reads and why each refuses rather than falls back, running from the repository root, the design gate reach, the deploy workflow, and the typecheck gap
---

# Build and deploy

## Overview

The page reads its figures at build time and deploys through `.github/workflows/deploy-site.yml`. `canon/context/web/overview.md` covers what the page composes, and `canon/context/web/capture.md` covers the pull request checks.

## Decisions

### Build-time reads refuse rather than fall back

`web/src/lib/derive.ts` holds every rule about what a read means as a pure function, unit tested beside it, and `session.ts` spawns the CLI, reads files, and hands the text over. Every reader refuses rather than falling back, since a figure drawn from nothing still renders.

- The rules figure reads the installed folder under `.claude/rules/canon/` for which rules the depicted session loaded, and the `gov list` catalog for what each carries
- The command field reads `canon --help` rather than `gov counts`, since the help is the surface a reader meets, which keeps the heading's count and the names under it one reading. The reader walks across the help's group headings and stops at the first heading ending in a colon
- The branch graph, the review exchange, the provenance roster, and the lit names in the field are authored against the depicted session, since nothing on a build machine records which files four sessions held. The footer says so, which is the labelling repair for an authored figure. The lit names are still checked against their catalog, so a renamed skill fails the build rather than lighting nothing
- The version dot lights only when the npm registry's latest matches the version the build carries. It reports state rather than a count, so an unreachable registry reads as unconfirmed and the build continues

Every string in `copy.ts` carries an inline citation to `README.md` or a paraphrase marker, gated by `readmeCitations` in `src/gate/measures.ts`. The citation discipline itself is stated in `internal/rules/claude/593-landing-page.md`.

### The build reads this checkout's CLI

`canon-cli.ts` spawns `bun` against this checkout's own `src/cli.ts` rather than `canon` on PATH. A PATH-resolved `canon` can be a different install, so a build in a linked worktree could read the main checkout's catalogs while the rest of the page rendered from the branch. It checks `stdout` rather than the exit code, since `canon gov counts` can exit 2 for drift elsewhere in the tree. `deploy-site.yml` runs no `bun link` step for the same reason.

`web:tokens` and `web:favicon` invoke `bun src/cli.ts` too. A global binary resolves to the main checkout whatever worktree runs it, so a build could overwrite a regenerated `web/src/styles/tokens.css` with output lacking the branch's own token changes.

### Running from the repository root

No `web/package.json` exists, since the repository declares no Bun workspaces. `bun run` invoked from elsewhere walks up to the root to run `web:build` and `web:preview`, pulling Playwright's cwd-relative output defaults with it, so `web/playwright.config.ts` anchors `outputDir` and its report folder to its own directory through `fileURLToPath(new URL('.', import.meta.url))`.

Every `web:*` script runs `cd web` before invoking astro rather than passing `astro --root web`, because the golden astro config's `@` alias resolves against the invoking process's cwd, as `canon/context/tooling/stacks.md` records.

`astro.config.mjs`'s `site` reads `process.env.ASTRO_SITE || site.origin` from `content/copy.ts`, rather than the reverse, since `copy.ts` carries the deployed origin that `og:url` and the card image already depend on.

### The design gate reaches the page

The `design` gate stage regenerates and drift-checks `web/src/styles/tokens.css` and `web/public/favicon.svg` alongside `canon/DESIGN.md` and `src/design/base.css`, since a value moved in `src/design/tokens.ts` would otherwise leave the web stylesheet and the tab icon stale with the gate green.

### Two copies of the path globs

`deploy-site.yml`'s push-trigger globs and `pr-visual-checks.yml`'s pull-request-trigger globs are two literal copies of the same eight shared entries, compared by the `visual-path-globs` gate stage through `visualPathGlobs` in `src/gate/measures.ts`. The visual list adds a ninth, `tooling/web/configs/e2e/**`, where the capture harness sits, which has no deploy counterpart since a harness edit changes no byte of the built site. `VISUAL_ONLY_GLOBS` beside it declares that entry to the stage, so any other one-sided glob still fails.

## Gotchas

- A module under the root `src/` that imports through `@/` cannot load from a `web/` Astro config, since every `web/` config aliases `@` to `web/src`. `src/design/css.ts` is one, which is why the card route spells its `@font-face` from `FONT_FACES` the way `base.astro` does. `src/design/fonts.ts` and `src/design/favicon.ts` import nothing and load fine.
- `web/` has no typecheck in the automated gate. The `types` stage in `src/gate/stages.ts` scopes to `/^src\/|^tsconfig\.json$|^package\.json$/`, the root `tsconfig.json` sets `include` to `["src"]`, and only the manual `bun run web:build`, through `astro check`, type-checks `web/` against `astro/tsconfigs/strict`. The unit tests under `web/src/lib/` do run in the root suite through the `web/src/**/*.test.ts` include in `vitest.config.ts`.
- Playwright takes reduced motion as a context option, `use.contextOptions.reducedMotion`. Written as a top-level `use.reducedMotion` it type-checks nowhere, since the config sits outside every typecheck, and reaches no page, so the suite runs with full motion while its config says otherwise.
