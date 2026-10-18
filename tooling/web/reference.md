# Tooling web reference

> Extends: `base`. Apply base stack first.

## Overview

The web layer covers the tooling shared across Vite + React, Astro, and Next.js. It sets lint, unit and end-to-end tests, Tailwind, screenshots, ports, and CI, and each framework stack adds its own wiring on top.

## oxlint

- Run the recommended, React, and test-scoped vitest rules, with `check-file` and `simple-import-sort` as JS plugins
- Pin oxlint exactly, since its JS plugin host is alpha and a minor release could break `check-file` or `simple-import-sort`
- Keep import sorting on `simple-import-sort`, because oxfmt's built-in sort orders differently and would rewrite every import block
- Expect sync to force-replace `lint` and `lint:fix`, so a target stops running ESLint. Astro keeps ESLint, which its own reference covers.
- Delete a leftover `eslint.config.js` or `eslint.config.mjs` and `bun remove` the ESLint packages by hand after that sync, since sync deletes nothing a stack stopped shipping

## Vitest

- Use jsdom, globals on, and `src/test/setup.ts`, which imports `@testing-library/jest-dom/vitest` and runs `cleanup` after each test
- Test components with `@testing-library/react` and `@testing-library/user-event`

## Playwright

- Keep end-to-end specs in `e2e/`, running Chromium alone for a Chrome extension and every browser for a web app

## Tailwind

- Use v4 through `@tailwindcss/vite`, never the v3 integration
- Back up `src/styles/global.css` before `bunx shadcn@latest init`, which silently overwrites it, and pass `-t -b -p -y` to skip prompts

## TypeScript and layout

- Keep app code in `src/`, Playwright in `e2e/`, shell in `scripts/`, and the Vitest globals in `src/test/setup.ts`
- Map the `@` alias to `./src` in both tsconfig and the framework's build config
- Keep the tsconfig at the root with `noEmit: true` in a Vite stack. Astro keeps the scaffold default from `@astrojs/check`.
- Typecheck with `tsc --noEmit`, never `tsc -b`, since composite mode emits `.js` next to `.ts` and the linter lints it

## Screenshot cases

- Extend the one `CASES` record in `e2e/screenshot.ts`, an entry per output file naming a section, a theme, and a route
- Expect each case crossed with `VIEWPORTS`, written to `screenshots/<hostname>/<section>/<width>--<theme>.png`, so a local run and a deployed run stay apart
- `VIEWPORTS` holds 320, 768, 1280, and 1536. Width 320 is the base a page has to hold without wrapping or clipping.
- Set `excludeViewports` to skip a width, for a route whose long-form prose reflows at 320 instead of breaking
- Set `evidence: true` to also write `evidence/<section>/<width>--<theme>.png` at 320 and 1280 alone, keeping the tracked set at twice the sections

## Screenshot sections and masks

- Name `sections` on a case, one `{ name, selector }` per addressable part of the route, each written as its own frame beside the whole-page one
- Expect a section frame at `screenshots/<hostname>/<section>/<name>/<width>--<theme>.png`, plus the same path under `evidence/` where flagged
- Expect a selector matching nothing to be reported and skipped, and test that every section resolves in the project owning the selectors
- List under `mask` the selectors painted over in every frame, for a value that moves with no code change, so a double capture compares the rest

## Screenshot settling

- Expect `reducedMotion: 'reduce'`, and each named section scrolled into view so an `IntersectionObserver` fires and `loading="lazy"` frames load before the page returns to the top
- Expect fonts, images, and same-origin frames waited out on a bounded condition, since a second `networkidle` does not re-arm for a load a scroll started
- Expect a section frame to drop floating chrome (`position: sticky` or `fixed`), while the whole-page frame is shot first and keeps its chrome

## Screenshot run flags

- `SCREENSHOT_FILTER` keeps cases whose `<section>/<width>--<theme>` label contains a comma-separated term, and exits 1 listing the labels on no match
- `--check-console-clean` exits 1 with the list if any `console` error fired, turning the capture into a smoke check
- `--require-base-url` exits 1 before launching a browser when `SCREENSHOT_BASE_URL` is unset, so a deployment script cannot capture `localhost`
- With a base URL, every flagged case is skipped so a production smoke run writes nothing to the committed path, and zero cases run exits 1

## Screenshot evidence

- Expect the sweep under `screenshots/` to be ignored and only a flagged case's `evidence/` output tracked, so a target's first capture is the baseline it commits
- Size a case's `sections` list against the frames each later change regenerates, since a case naming sections commits a folder per section
- Run the capture after a surface changes, component files included, per `governance/rules/ui/surface-capture.md`, unless the production build strips the component out

## Screenshot scripts and workflows

- `scripts/screenshot.sh` sources `scripts/lib/preview-server.sh`, builds, serves on `PREVIEW_PORT`, waits for the port, and traps the whole process group on exit
- `scripts/readme-screenshot.sh` captures one case under `SCREENSHOT_FILTER` into `assets/evidence/readme/`, and exits 1 until a project fills `README_FILTER`
- `.github/workflows/readme-screenshot.yml` ships its path list as `REPLACE_WITH_PROJECT_PATHS`, and its first step exits 1 while that stays
- `.github/workflows/verify.yml` runs `static-checks`, `unit-tests`, `build-verify`, and `e2e-tests`
- Read `governance/rules/tooling/ci-workflow.md` for when a workflow's commit-back is right and when a report is

## Ports

- Derive every served port from `scripts/worktree-port.sh`, never a port literal in a script string, since two worktrees of one repository otherwise attach to one server
- Read `WORKTREE_PORT_OFFSET` in a config and add it to the stack's default port. Unset yields the default, so a plain clone keeps its port.
- Expect an offset from a band of 50 hashed from the worktree folder name, and set `WORKTREE_PORT_OFFSET` by hand to break a tie between two worktrees
- Set `strictPort` on every dev and preview server, and Playwright `reuseExistingServer: false`, since a walked or reused server passes against the wrong code
- Call the helper as `VAR=$(bash scripts/worktree-port.sh) && export VAR && <server>`, since an assignment prefix discards the substitution's exit and starts the server at offset zero

## Ports in a removed worktree

- Expect a non-zero exit and no port from a folder left under `.claude/worktrees/` once its worktree is gone, since git reports the parent repository from inside one
- Expect a folder whose own `.git` was deleted to refuse only under that directory, since location alone separates it from an ordinary subdirectory
- Expect a folder whose `.git` names a pruned administrative directory to refuse wherever it sits
- Set `WORKTREE_PORT_OFFSET` by hand to serve from such a folder anyway, since it is the one override and is checked before any directory test

## lint-staged (extend)

- Add `**/*.{js,jsx,ts,tsx}` running `oxlint --fix --max-warnings 0` and `oxfmt --no-error-on-unmatched-pattern`
- Extend the oxfmt glob to include `css`, giving `**/*.{json,css,md}`

## Verify script

- Expect `scripts/verify.json` to require `typecheck`, `lint`, `test:run`, and `build`, which base's `scripts/verify.ts` runs in its fixed order
- That order is typecheck, lint, format, shell where the `shell` stack declares it, unit tests, build, markdown bans, then the card exclusion check
- Expect the card stage to run `scripts/check-card-exclusion.sh` whenever that file is installed, so a project with no card route runs one less stage with no override

## CI docs (extend)

- Extend the `## Checks` table in `canon/context/development/ci.md` with the web jobs <!-- audit-ignore-citations: canon/context/development/ci.md -->
- Document under `## Running CI locally` that `bun run check:full` runs verify plus `test:e2e`

| Check     | Command                 | What it asserts                             |
| --------- | ----------------------- | ------------------------------------------- |
| Typecheck | `bun run typecheck`     | framework-specific typecheck passes         |
| Lint      | `bun run lint`          | oxlint passes with zero warnings            |
| Tests     | `bun run test:coverage` | Vitest passes with coverage thresholds      |
| Build     | `bun run build`         | Production build succeeds                   |
| E2E       | `bun run test:e2e`      | Playwright passes against the built preview |

## Development docs (extend)

- Extend the `## Scripts` table in the `development` context entry under `canon/context/` with every web script
- Expect each framework stack to add its `dev`, `build`, `preview`, and `typecheck` rows

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
