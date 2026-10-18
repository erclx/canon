# Tooling web reference

> Extends: `base`. Apply base stack first.

## Overview

The web layer covers the tooling shared across Vite + React, Astro, and any future web stack. It ships golden configs for oxlint, Vitest, Playwright, Tailwind v4, screenshots, VS Code integration, and CI. Framework wiring (Vite plugins, Astro islands, Next.js config) lives in per-stack adapter folders that extend this layer.

## What ships as golden configs

Golden configs live in `tooling/web/configs/`. `canon tooling sync web . --write` copies them into the target and replaces whatever sits at those paths. They are the source of truth, so this reference covers rationale and the configs show the setup.

### Lint and test setup

Two configs carry the lint and unit-test baseline.

- `.oxlintrc.json` is migrated from the ESLint config it replaced. It runs the recommended, React, and test-scoped vitest rules, with `check-file` and `simple-import-sort` as JS plugins.
- `src/test/setup.ts` imports `@testing-library/jest-dom/vitest` and runs `cleanup` after each test.

### Screenshot cases

`e2e/screenshot.ts` is the capture harness, overwritten on sync. The seeded `e2e/capture/cases.ts` holds the `CASES` a project edits, one entry per output file naming a section, a theme, and a route.

- The loop crosses every case with `VIEWPORTS` and writes `screenshots/<hostname>/<section>/<width>--<theme>.png`. The hostname of `SCREENSHOT_BASE_URL` keeps local and deployed runs apart.
- `VIEWPORTS` holds 320, 768, 1280, and 1536. Width 320 is the base a page has to hold without wrapping or clipping.
- `excludeViewports` skips a width, for a route whose long-form prose reflows at 320 instead of breaking.
- `evidence: true` also writes `<EVIDENCE_ROOT>/<section>/<width>--<theme>.png` at 320 and 1280 alone. `EVIDENCE_ROOT` defaults to `e2e/evidence`.
- Migration: move cases from a project's own `e2e/screenshot.ts` to `e2e/capture/cases.ts` before the next sync, and set `EVIDENCE_ROOT = 'evidence'` to keep the baseline.

### Sections and masks

A case may name `sections`, one `{ name, selector }` per addressable part of the route. Each writes its own frame beside the whole-page one.

- A section frame lands at `screenshots/<hostname>/<section>/<name>/<width>--<theme>.png`, plus the same path under `EVIDENCE_ROOT` where the case and width are flagged.
- A selector matching nothing is reported and skipped, since a seeded list may name sections the page lacks. The project owning the selectors tests that they resolve.
- `mask` lists selectors painted over in every frame, for a value that moves with no code change, so a double capture compares the rest.

### Settling before a shot

Every case settles before anything is shot.

- The context uses `reducedMotion: 'reduce'`, and each named section scrolls into view so an `IntersectionObserver` fires and `loading="lazy"` frames load. The page then returns to the top.
- Fonts, images, and same-origin frames are waited out on a bounded condition. A second `networkidle` does not re-arm for a load a scroll started.
- A section frame drops floating chrome (`position: sticky` or `fixed`), which would otherwise ride the scroll into the frame. The whole-page frame is shot first and keeps its chrome.

### Run flags

Three controls narrow or harden a run.

- `SCREENSHOT_FILTER` keeps cases whose `<section>/<width>--<theme>` label contains a comma-separated term. It exits 1 and lists the labels on no match.
- `--check-console-clean` exits 1 with the list if any `console` error fired, turning the capture into a smoke check.
- `--require-base-url` exits 1 before launching a browser when `SCREENSHOT_BASE_URL` is unset, so a deployment script cannot capture `localhost`.
- With a base URL, it skips every flagged case so a production smoke run writes nothing to the committed path, and exits 1 when zero cases run.

### Scripts and workflows

The wrappers around the capture and the verify run. `governance/rules/tooling/ci-workflow.md` states when a workflow's commit-back is right and when a report is.

- `scripts/screenshot.sh` sources `scripts/lib/preview-server.sh`, never executed itself. It builds, serves on `PREVIEW_PORT`, waits for the port, and traps the whole process group on exit.
- `scripts/readme-screenshot.sh` captures one case under `SCREENSHOT_FILTER` into `assets/evidence/readme/`. `README_FILTER` ships empty, so it exits 1 until a project fills it.
- `.github/workflows/readme-screenshot.yml` ships its path list as `REPLACE_WITH_PROJECT_PATHS`, and its first step exits 1 while that stays.
- `.github/workflows/verify.yml` runs `static-checks`, `unit-tests`, `build-verify`, and `e2e-tests`. `unit-tests` installs Chromium and runs `test:browser` only when the project defines that script.

## What stays in per-stack adapters

Framework glue lives in `tooling/vite-react/configs/` or `tooling/astro/configs/`, because merge helpers and config shapes differ.

- `vite.config.ts` or `astro.config.mjs` holds the framework's config.
- `vitest.config.ts` uses `mergeConfig` in Vite stacks and `getViteConfig` from `astro/config` in Astro.
- `playwright.config.ts` differs in its `webServer` command.
- `tsconfig.json` differs in its `extends` target. Astro uses `astro/tsconfigs/strict` and Vite projects use scaffold defaults.

## File layout

- `src/` holds app code, `e2e/` Playwright, `scripts/` shell, and `src/test/setup.ts` the Vitest globals.
- Path alias `@` maps to `./src` in both tsconfig and the framework's build config.
- Tsconfig sits at root with `noEmit: true` in Vite stacks. Astro keeps the scaffold default from `@astrojs/check`.

## Ports

Two worktrees of one repository run the same stack, so a fixed port makes the second one attach to the first.

### Deriving the port

The helper owns the offset, and a config only adds it.

- Derive every served port from `scripts/worktree-port.sh`. Never write a port literal into a script string.
- Read `WORKTREE_PORT_OFFSET` in a config and add it to the stack's default port. Unset yields the default, so a plain clone keeps its port.
- The offset comes from a band of 50 hashed from the worktree folder name. Two worktrees can collide, so set `WORKTREE_PORT_OFFSET` by hand to break a tie.
- Force-replace `dev` and `preview` through `[scripts.override]`, since a plain `[scripts]` entry never replaces a key the scaffold wrote.
- Set `strictPort` on every dev and preview server, and Playwright `reuseExistingServer: false`. A server that walks to another port, or a reused one, passes against the wrong code silently.

### Calling the helper

Call it as `VAR=$(bash scripts/worktree-port.sh) && export VAR && <server>`, never as `VAR=$(bash scripts/worktree-port.sh) <server>`. An assignment prefix discards the exit status of its own substitution. The shorter form starts the server with `VAR` empty, which every config reads as offset zero.

### Refusal in a removed worktree

Expect a non-zero exit and no port from a folder left under `.claude/worktrees/` once its worktree is gone. Git reports the parent repository from inside one, so every base served would land on the main checkout's port.

- A folder whose own `.git` was deleted refuses only under that directory, since location alone separates it from an ordinary subdirectory.
- A folder whose `.git` names a pruned administrative directory refuses wherever it sits.
- Set `WORKTREE_PORT_OFFSET` by hand to serve from such a folder anyway. It is the one override and is checked before any directory test.

## Anti-patterns

Negative knowledge that costs a failed run to relearn.

| Do NOT                                          | Why and what to do                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Use `exclude: ["e2e"]`                          | Bare-folder globs miss. Use `"e2e/**/*"`.                                                              |
| Put Playwright `trace` at the top of the config | It lives under `use`.                                                                                  |
| Ship Vitest failing on no tests                 | Fresh scaffolds have none. Use `passWithNoTests: true` until one exists.                               |
| Skip `skipLibCheck: true` in Vite + React       | `@testing-library/jest-dom` and Vite's `module-runner` conflict otherwise.                             |
| Use `tsc -b` in a Vite project                  | Composite mode emits `.js` next to `.ts` and the linter lints it. Use `tsc --noEmit`.                  |
| Trust `vite-react`'s scaffolded `lint` script   | Its bare `oxlint` exits 0 on warnings. `[scripts.override]` forces `--max-warnings 0` over it.         |
| Run `bunx shadcn@latest init` over `global.css` | It silently overwrites `src/styles/global.css`. Back up first, and pass `-t -b -p -y` to skip prompts. |

## Tool pairing

- Unit tests use Vitest with jsdom, globals on, `src/test/setup.ts`, `@testing-library/react`, and `@testing-library/user-event`.
- E2E uses Playwright in `e2e/`, Chromium only for Chrome extensions and all browsers for web apps.
- Tailwind is v4 through `@tailwindcss/vite`, never the v3 integration.
- Lint is oxlint at an exact pin, since its JS plugin host is alpha and a minor release could break `check-file` or `simple-import-sort`. Astro keeps ESLint, which its own reference covers.

## oxlint

- Set `lint` and `lint:fix` through `[scripts.override]`, so a synced target stops running ESLint on its next sync.
- After that sync, delete a leftover `eslint.config.js` or `eslint.config.mjs` and `bun remove` the ESLint packages by hand. Sync deletes nothing a stack stopped shipping.
- Keep import sorting on `simple-import-sort`, because oxfmt's built-in sort orders differently and would rewrite every import block.

## lint-staged (extend)

- Add `**/*.{js,jsx,ts,tsx}` running `oxlint --fix --max-warnings 0` and `oxfmt --no-error-on-unmatched-pattern`.
- Extend the oxfmt glob to include `css`, giving `**/*.{json,css,md}`.

## CI docs (extend)

Extend `canon/context/development/ci.md` so the `## Checks` table reflects the web jobs. <!-- audit-ignore-citations: canon/context/development/ci.md -->

| Check     | Command                 | What it asserts                             |
| --------- | ----------------------- | ------------------------------------------- |
| Typecheck | `bun run typecheck`     | framework-specific typecheck passes         |
| Lint      | `bun run lint`          | oxlint passes with zero warnings            |
| Tests     | `bun run test:coverage` | Vitest passes with coverage thresholds      |
| Build     | `bun run build`         | Production build succeeds                   |
| E2E       | `bun run test:e2e`      | Playwright passes against the built preview |

Under `## Running CI locally`, document that `bun run check:full` runs verify plus `test:e2e`.

## Development docs (extend)

Extend the `development` context entry under `canon/context/` so the `## Scripts` table lists every web script. Stack adapters add their `dev`, `build`, `preview`, and `typecheck` rows.

| Command                     | Purpose                                 |
| --------------------------- | --------------------------------------- |
| `bun run lint`              | Run oxlint, no warnings allowed.        |
| `bun run lint:fix`          | Auto-fix oxlint issues.                 |
| `bun run test`              | Run Vitest in watch mode.               |
| `bun run test:run`          | Run Vitest once, verbose.               |
| `bun run test:coverage`     | Run Vitest with coverage.               |
| `bun run test:e2e`          | Run Playwright E2E tests.               |
| `bun run test:e2e:changed`  | Run specs the diff's import graph hits. |
| `bun run screenshot`        | Build, preview, capture screenshots.    |
| `bun run readme-screenshot` | Capture the README frame.               |
| `bun run smoke:prod`        | Capture against a required base URL.    |

### Screenshot contract

`canon tooling verify <stack>` is the only automated caller of `bun run screenshot`. It runs the script for any stack whose `package.json` declares it and asserts that PNG files land under `screenshots/`.

- The count is a recursive find with no depth limit, so the seed's section folders satisfy it. Do not flatten the layout to protect that check.
- `governance/rules/ui/surface-capture.md` asks a session to run the capture after a surface changes, component files included, with an exemption for a component the production build strips out.
- The sweep under `screenshots/` is ignored and only a flagged case's `evidence/` output tracks, so a target's first capture is the baseline it commits.
- A case naming sections commits a folder per section, so size the list against the frames each later change regenerates.

## Gitignore (extend)

These `[gitignore]` groups mirror the manifest.

- `"# Playwright" = ["test-results/", "playwright-report/", "blob-report/", "playwright/.cache/"]`
- `"# Screenshots" = ["screenshots/"]`

## Verify script

The web layer's `scripts/verify.json` requires `typecheck`, `lint`, `test:run`, and `build`. Base's `scripts/verify.ts` runs them in its fixed order, being typecheck, lint, format, shell where the `shell` stack declares it, unit tests, build, markdown bans, then the card exclusion check where installed.

- Astro, vite-react, and nextjs inherit the list, since the nearest stack's copy wins. An adapter whose phases differ ships its own `verify.json` rather than a script.
- The card stage runs `scripts/check-card-exclusion.sh` whenever that file is installed, keeping the social card route's build exclusion on the default path rather than behind a flag.
- It tests for the script rather than the stack, so a project with no card route runs one less stage with no override.
- The stack shipping a card route owns what the check reads, being the build the stage before it produced. The astro reference carries the route itself.
