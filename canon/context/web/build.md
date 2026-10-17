---
title: Build and deploy
description: The build-time reads and why each refuses, running from the repository root, the design gate reach, and the typecheck gap
---

# Build and deploy

## Overview

The page reads its figures at build time and deploys through `.github/workflows/deploy-site.yml`. `canon/context/web/overview.md` covers what the page composes, and `canon/context/web/capture.md` the pull request checks.

## Decisions

### Build-time reads refuse rather than fall back

`web/src/lib/derive.ts` holds every rule about what a read means as a pure function, unit tested beside it. `session.ts` spawns the CLI, reads files, and hands the text over. Every reader refuses rather than falling back, since a figure drawn from nothing still renders.

- The rules figure reads the installed folder under `.claude/rules/canon/` for which rules the depicted session loaded, and the `gov list` catalog for what each carries
- The command field reads `canon --help` rather than `gov counts`, since the help is the surface a reader meets, which keeps the heading's count and the names under it one reading
- The reader walks the help's group headings and stops at the first heading ending in a colon

### The skills field refuses in both directions

The skills field reads `docs/workflow/skill-map.md` and `docs/workflow/skill-map-on-request.md` through `skillGroups`. `session.ts` joins the two pages' text in that order before the call, so one rule refuses across both.

- A row whose first cell is a backticked `canon:<name>` is that skill's usage text
- The group and its order come from the skill's `metadata.family` and the `families` vocabulary `canon claude skills list --json` emits
- It refuses a catalog skill with no row and a row naming no catalog skill, since a skill missing from the map would drop out of the field while the heading's count still named it
- It also refuses a row it cannot split into two cells, a row filed under a heading other than its family's group, and a heading naming no family group, matched exactly after trimming

Both workflows list both pages in their path filters, so a pull request that only drops a row from either still runs the build.

### The merge figure and authored fields

The merge figure reads `canon hooks post-merge --help` for which verbs a merge runs. `.husky/post-merge` hands every step to that verb, and the help lists them from `STEP_VERBS` in `src/hooks/post-merge.ts`. The figure refuses when the hook stops calling the verb.

A change to the post-merge steps changes the page, and no web workflow's path filter catches it, so `bun run web:build` is the proof.

- The branch graph, review exchange, provenance roster, and lit field names are authored against the depicted session, since no build machine records which files four sessions held
- The footer says so, which is the labelling repair for an authored figure. The lit names are still checked against their catalog, so a renamed skill fails the build rather than lighting nothing.
- The version dot lights only when the npm registry's latest matches the build's version. It reports state rather than a count, so an unreachable registry reads as unconfirmed and the build continues.

Every string in `copy.ts` carries an inline citation to `README.md` or a paraphrase marker, gated by `readmeCitations` in `src/gate/measures.ts`. `internal/rules/claude/landing-page.md` states the citation discipline.

### The build reads this checkout's CLI

`canon-cli.ts` spawns `bun` against this checkout's own `src/cli.ts` rather than `canon` on PATH. A PATH-resolved `canon` can be a different install, so a build in a linked worktree could read the main checkout's catalogs while the rest of the page rendered from the branch.

- It checks `stdout` rather than the exit code, since `canon gov counts` can exit 2 for drift elsewhere in the tree
- `deploy-site.yml` runs no `bun link` step for the same reason
- `web:tokens` and `web:favicon` invoke `bun src/cli.ts` too, since a global binary resolves to the main checkout and could overwrite `tokens.css` without the branch's changes

### Running from the repository root

No `web/package.json` exists, since the repository declares no Bun workspaces. `bun run` invoked from elsewhere walks up to the root to run `web:build` and `web:preview`, pulling Playwright's cwd-relative output defaults with it.

`web/playwright.config.ts` anchors `outputDir` and its report folder to its own directory through `fileURLToPath(new URL('.', import.meta.url))`.

- Every `web:*` script runs `cd web` rather than passing `astro --root web`, because the golden config's `@` alias resolves against the invoking cwd, per `canon/context/tooling/stacks.md`
- `astro.config.mjs` reads `process.env.ASTRO_SITE || site.origin` from `content/copy.ts`, since `copy.ts` carries the deployed origin that `og:url` and the card image already depend on

### The design gate reaches the page

The `design` gate stage regenerates and drift-checks `web/src/styles/tokens.css` and `web/public/favicon.svg` alongside `canon/DESIGN.md` and `src/design/base.css`. A value moved in `src/design/tokens.ts` would otherwise leave the web stylesheet and the tab icon stale with the gate green.

### Two copies of the path globs

`deploy-site.yml`'s push globs and `pr-visual-checks.yml`'s pull-request globs are two literal copies of the same nine shared entries. The `visual-path-globs` gate stage compares them through `visualPathGlobs` in `src/gate/measures.ts`.

- One of the nine is the negation `!assets/evidence/**` under `assets/**`, in both copies on purpose
- Pull request screenshots are nothing the page reads, and `canon pr preview` reads the deploy filter to decide whether a site preview shows the change
- The cost is that a pull request moving only the `assets/evidence/home/` baseline runs no capture job, which is a baseline compared against the page it was just regenerated from
- The visual list adds a tenth, `tooling/web/configs/e2e/**`, with no deploy counterpart, since a harness edit changes no byte of the built site
- `VISUAL_ONLY_GLOBS` declares that entry to the stage, so any other one-sided glob still fails

## Gotchas

### Imports through the alias

A module under the root `src/` that imports through `@/` cannot load from a `web/` Astro config, since every `web/` config aliases `@` to `web/src`. `src/design/css.ts` is one, so the card route spells its `@font-face` from `FONT_FACES` the way `base.astro` does. `src/design/fonts.ts` and `src/design/favicon.ts` import nothing and load fine.

### No typecheck in the gate

`web/` sits outside the automated typecheck.

- `web/` has no typecheck in the automated gate. The `types` stage scopes to `src/`, `tsconfig.json`, and `package.json`, and the root `tsconfig.json` includes only `src`.
- `bun run web:build`, through `astro check`, is the only check of `web/`
- The unit tests under `web/src/lib/` do run in the root suite, through the `web/src/**/*.test.ts` include in `vitest.config.ts`

### Reduced motion in Playwright

Playwright takes reduced motion as `use.contextOptions.reducedMotion`. A top-level `use.reducedMotion` type-checks nowhere, since the config sits outside every typecheck, and reaches no page, so the suite runs with full motion.
