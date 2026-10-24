---
title: Local workflow
description: Local dev workflow, scripts, and husky hooks
---

# Local workflow

## Overview

Owns how the project runs on a developer machine, being the toolchain, the scripts that verify a change, and the git hooks that run them. CI calls the same scripts, covered in `canon/context/development/ci.md`.

Setup is Bun and the `canon` CLI from `bun add -g @erclx/canon`, which the pre-commit hook calls, then `bun install` to activate the hooks, then `bunx playwright install chromium`.

## Layout

### Scripts

These gate a change, and `bun run check` is the one the pre-push hook runs.

| Command                            | Purpose                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `bun run check`                    | Gates locally and writes nothing, running typecheck, lint, format, unit tests, build, and markdown bans |
| `bun run check:full`               | Runs `check`, then `test:e2e`                                                                           |
| `bun run typecheck`                | Runs `tsc --noEmit` over `src/`, `e2e/`, and the root configs                                           |
| `bun run lint`, `bun run lint:fix` | Runs oxlint with zero warnings allowed, and auto-fixes its issues                                       |
| `bun run format`                   | Auto-fixes oxfmt formatting                                                                             |
| `bun run build`                    | Builds the client into `dist/client/` with Vite, then `dist/cli.js` and `dist/hook.js` with rolldown    |

These serve the board and run the test layers.

| Command                    | Purpose                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `bun run preview`          | Serves `basic` under `CANON_PREVIEW_ROOT` (unset: committed board) at `PREVIEW_PORT`, 4173, and no tab |
| `bun run dev`              | Serves the client with hot reload on 5173, proxying to a `preview` on 4173 plus the worktree offset    |
| `bun run test`             | Runs Vitest in watch mode                                                                              |
| `bun run test:run`         | Runs both Vitest projects, `node` and `browser`, once                                                  |
| `bun run test:coverage`    | Runs the `node` project with coverage, as CI's unit-tests job does                                     |
| `bun run test:e2e`         | Runs Playwright against the built CLI on a port offset per worktree                                    |
| `bun run test:e2e:changed` | Runs Playwright on specs the import graph reaches from the current diff                                |

Two of those need a companion command or variable.

- Start the `preview` that `dev` proxies to with `PREVIEW_PORT=$(bash scripts/worktree-port.sh 4173) bun run preview`
- Point `preview` at a drive copy with `CANON_PREVIEW_ROOT=<copyRoot>` from `canon pr drive-copy --json`, and leave it unset to serve the committed board
- Run the edit writer's tests on Bun with `bun --bun vitest run --project node src/server/edit`, adding `FRAMEBOARD_EDIT_DIGEST=<path>` to write the output digest

These capture and measure what the board renders.

| Command                      | Purpose                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `bun run measure:canvas`     | Pans and pinches over fifty live frames in headed Chrome and prints p50, p95, and the share past 33 ms  |
| `bun run screenshot`         | Builds, serves, and captures every case in `e2e/capture/` into `screenshots/` and `e2e/evidence/`       |
| `bun run screenshot:compare` | Captures each shell surface at the references' 1440 by 900, light and dark, into `screenshots/compare/` |
| `bun run smoke:prod`         | Captures against `SCREENSHOT_BASE_URL`, failing on any console error                                    |
| `bun run design:sync`        | Builds, then captures each board frame `canon/design/frames.json` maps into its group folder            |

The capture scripts each carry a condition the table leaves out.

- `screenshot:compare` builds first and serves its own boards
- `design:sync --check` writes nothing, fails on a changed frame or kit file and on a missing or stray file, and warns on a PNG whose bytes differ
- `design:sync` reads the design board at the main root's `.canon/board` through the built CLI's `capture`, from any worktree
- `measure:canvas` sits outside the gate, because its number describes the developer's own browser and screen and a CI runner's says nothing about either

### `scripts/`

Owns the shell scripts and the verify runner the commands above call, and every `.sh` file lives here but the plugin's resolver and `.claude/hooks/`.

- `worktree-port.sh` hashes a linked worktree's name into a port offset from 1 to 50, leaving 0 for the main checkout
- Two worktrees collide on a port offset about 1 time in 50, so set `WORKTREE_PORT_OFFSET` by hand to break the tie
- `design-sync.ts` writes `canon/design/` and nothing in `src/` imports it, so it is a dev script outside the gate, and `.prettierignore` and `.oxlintrc.json` keep the folder out of format and lint

### `.husky/`

Owns the git hooks.

- `pre-commit` runs `lint-staged`, being oxlint and oxfmt on staged code, oxfmt on JSON, CSS, and markdown, and `canon indexes regen` on markdown
- `commit-msg` runs `commitlint` against the conventional commit format
- `pre-push` runs `bun run check`, so a push fails on formatting drift until `bun run format` runs, since the hook writes nothing

### `e2e/`

Owns the Playwright specs, the helpers under `e2e/support/`, the capture harness `e2e/screenshot.ts`, its cases under `e2e/capture/`, and the committed baseline under `e2e/evidence/`.

- A spec that writes board files serves its own copy of a fixture through `e2e/support/board-server.ts`, since writing into the committed fixture would leak between specs
- `playwright-core`, the one runtime dependency, is pinned to the version `@playwright/test` resolves, so bump both together
- A capture case picks its theme by saving `frameboard.theme` from an init script, since the board reads the choice before its first paint and a class added by hand is overwritten

### `test/`

Owns the fixture boards under `test/fixtures/boards/` and the helpers under `test/support/`, and holds no tests itself, so unit tests, specs, and later rows read one copy.

- `.prettierignore` keeps oxfmt out of `test/fixtures/`, since a fixture's bytes are what its test asserts and the `broken` board holds JSON that does not parse
- The `capture` board names only generic families and a Geist face in its `assets/`, so it renders alike on Linux CI and macOS

### Other folders

Test support that lives inside the source tree.

- `src/test/` owns the setup file the Vitest `browser` project loads and the board records client tests build from

## Gotchas

### Tooling

These catch the toolchain out.

- `canon tooling sync web . --write` overwrites the project's own `e2e/screenshot.ts`, `e2e/home.spec.ts`, `.oxlintrc.json`, and `commitlint.config.js`, so copy a stack file by hand instead
- `canon sync` writes `canon/config/config.json` in a shape oxfmt rejects, so run `bun run format` before the commit
- `vitest.config.ts` clears the `server.strictPort` from `vite.config.ts`, so parallel unit runs hop off a taken 63315 while `dev`, `preview`, and the e2e servers still fail on one
- `vitest.config.ts` also strips the dev proxy before merging, so a browser test's frame iframe gets a 404 from vitest's own server rather than reaching whatever listens on 4173

### Preview servers

These catch a running `preview` out.

- `canon pr drive-copy` rebuilds the copy and drops its `.run/`, so a `preview` already serving it loses its address file and board key, and a rebuild belongs at the start of a pass
- Playwright never reuses a running server, and a `preview` on any port makes the e2e `serve` report `reused` and exit, so stop the preview before running specs
