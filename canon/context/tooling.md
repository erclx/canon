---
title: Tooling
description: The golden configs and seeds a project inherits, the stack layering and manifests that decide what sync injects, the seed gates, the web capture harness, and the end-to-end verify
---

# Tooling

## Overview

Owns the golden configs a project inherits, layered across a `base` to `web` to framework chain where each layer ships only its own slice. A stack is a folder of configs, seeds, a manifest, and a reference, and sync discovers a new one unaided. A config always overwrites on sync, and a seed is copied once and then belongs to the target.

## Layout

### `tooling/<stack>/`

Holds one stack, always with a `manifest.toml` and a `reference.md`, plus `configs/` and `seeds/`. A stack that stands alone, such as `cloudflare` or `shell`, sets `extends = ""` and layers onto a root already carrying another.

- Adding a stack means copying the closest one from `canon tooling list`, filling its manifest and reference, adding configs and seeds, and running `canon tooling verify <name>`
- A manifest block injects one thing. `[dependencies.dev]` and `[scripts]` add only what is missing, `[gitignore]` adds a group, and `[verify] prepare` runs between scaffold and sync.
- `python`, `go`, and `php` extend `base` directly and run on `uv`, `go`, and `composer`, so their scaffolds write no `package.json` and `[verify] prepare` runs `bun init -y`
- A script changes only through `[scripts.override]`, for a scaffold anti-pattern, a wrapper that tracks a shipped shell script, or a key the stack owns
- `astro` keeps Prettier and ESLint for `.astro` files only, and its `.oxfmtrc.json` repeats base's options because scan takes a child config over the parent's whole file

### `tooling/web/`

Holds the layer that ships the capture harness and the served port. Its `verify.yml` is a config shadowing base's seed at the same path, so a web target receives every change to it.

- `configs/scripts/worktree-port.sh` prints a base plus an offset hashed from the worktree folder name, and refuses a leftover folder under `.claude/worktrees/` whose `.git` is gone
- Every manifest script calling the helper guards it with `&& export VAR &&`, because an assignment prefix discards the substitution's exit status
- The capture seed writes `<section>/<name>/<theme>.png` per case at 320, 768, 1280, and 1536 pixels, and a case flagged `evidence: true` lands in a committed folder that `--require-base-url` skips
- `configs/scripts/screenshot.sh` builds, previews, and polls, and its `EXIT` trap kills the preview by pid and by port, as `src/tooling/screenshot-trap.test.ts` exercises
- `tooling/astro/configs/src/components/dev/scenarios.astro` is a query-parameter switcher between candidate treatments, shipped under the application-code proof

### `tooling/base/`

Holds the repository-root configs and the seeds every project starts with.

- Base's `verify.yml` and PR template are seeds because a polyglot target extends them, and `configPaths` shadows a seed at a path a stack in the chain ships as a config
- `seedIndependence` in `src/gate/boundaries.ts` fails on seed markdown naming the toolkit binary, so a seed describes an optional capability instead
- `capabilitySeeding` fails a hook, workflow, or husky script with no seed unless the file carries a `canon-no-seed:` comment, and it compares filenames only
- A seed exempts itself from the section check with `stub: true`, which `src/tooling/seed-marker.ts` strips on both install paths
- `planSeeds` in `src/claude/seeds.ts` iterates a literal `SUBDIRS` array, so a new claude seed folder needs its entry, an `install-check.sh` assertion, and a `canon claude init` run

### `src/tooling/`

Owns the manifest walk, scan, injection engine, stamp, reference resolver, and verify.

- `scan` walks the current stack first and a file seen there blocks the same path from every parent, so dependencies and gitignore entries alone resolve from the furthest ancestor inward
- `mergeSections` writes a group header only when the whole group is missing, treats `.canon/tmp` and `.canon/tmp/` as one entry, and never rewrites a line
- `resolveWriteMode` in `src/commands/tooling.ts` maps `--check` to report, `--write` to apply, and a TTY to a prompt, and a headless caller with neither flag reports and exits 1
- `canon tooling diff` dispatches into `runSync` with `check` set and exits 1 on any difference, and `--json` answers `{ ok: false, reason, message }` on a refusal
- A target below its git toplevel syncs as a subfolder. Every `.github/` file is withheld, `[sync] per_root` keeps a skipped stack's named configs, and with no `package.json` only the gitignore lands.

### `src/tooling/verify-stack.ts`

Runs `canon tooling verify <stack>` by scaffolding into `.canon/tmp/runs/verify-<stack>/`, running `[verify] prepare`, syncing, then running `lint:fix`, `format`, `check`, `test:e2e`, and `screenshot` with `CI` set.

- A failed phase is recorded and the run continues, a scaffold with no `package.json` after sync fails it, and `--keep` preserves a green run
- The sync phase runs `bun <root>/src/cli.ts` from the checkout, never `canon` on PATH
- `web` has no scaffold command, so a change to `tooling/web/configs/` is verified through `vite-react` and `astro`
- Run it after any change to `tooling/<stack>/configs/`, a manifest, or `src/tooling/`
- Install Playwright browsers from the scaffold's `node_modules/.bin/`, since `web` leaves `@playwright/test` unpinned and a scaffold can resolve a newer release than this checkout's

### Other folders

Two checks and one finder sit beside the engine.

- `tooling/claude/` is storage for `canon claude` and no stack, so `EXCLUDED_STACKS` in `src/tooling/manifest.ts` keeps it out of discovery
- `tooling/*/reference.md` carries only what a config cannot express, and `internal/rules/claude/tooling-reference.md` holds its symmetry with the manifest
- `ignoreParity` in `src/gate/boundaries.ts` fails when the repository `.gitignore` and the claude manifest disagree on `.canon/` or `.claude/worktrees/`
- `seedRoots` in `src/tooling/seeds.ts` finds each `tooling/<stack>/seeds/` carrying `.claude/` or `canon/` for the seed gate

## Gotchas

- `Bun.Glob` skips dotfiles unless `dot: true` is set, and tooling configs are mostly dotfiles, so omitting it matches 4 of 14 files in `base`
- Commit golden config changes with `--no-verify`, since lint-staged runs against the template files themselves
- A bare `canon` on PATH resolves `PROJECT_ROOT` to the installed package, so `create`, `inject`, `list`, and `prune-gitignore` warn when it differs from the checkout
- The astro golden config's `@` alias resolves against the process cwd, so run astro from the project root and never with `--root <subdir>`
- Two seed sources writing one destination let install order pick the content, since `canon init` runs base before the Claude domain and `pendingSeeds` skips an existing path
