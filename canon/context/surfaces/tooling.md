---
title: Tooling
description: The golden configs and seeds a project inherits, the stack layering and manifests that decide what sync injects, the seed gates, the web capture harness, and the end-to-end verify
---

# Tooling

## Overview

Owns the golden configs a project inherits, layered across a `base` to `web` to framework chain where each layer ships only its own slice. A stack is a folder of configs, seeds, a manifest, and a reference, and sync discovers a new one unaided. Sync replaces only a config the project left alone, and copies a seed once.

## Layout

### `tooling/<stack>/`

Holds one stack, always with a `manifest.toml` and a `reference.md`, plus `configs/` and `seeds/`. A stack that stands alone, such as `cloudflare` or `shell`, sets `extends = ""` and layers onto a root already carrying another.

- Adding a stack means copying the closest one from `canon tooling list`, filling its manifest and reference, adding configs and seeds, and running `canon tooling verify <name>`
- A manifest block injects one thing. `[dependencies.dev]` and `[scripts]` add only what is missing, `[gitignore]` adds a group, and `[verify] prepare` runs between scaffold and sync.
- `runtime` is reserved and read by nothing, and `scaffold` is read only by `sandbox/tooling/upstream.ts`, never by `canon tooling sync`
- `python`, `go`, and `php` extend `base` directly and run on `uv`, `go`, and `composer`, so their scaffolds write no `package.json` and `[verify] prepare` runs `bun init -y`
- A script changes only through `[scripts.override]`, as `vite-react` forces `--max-warnings 0` onto the scaffold's oxlint, and the drift scan reads a stale override as `drifted`

### `tooling/astro/`

Holds the one stack that lints with ESLint and formats `.astro` files with Prettier, since oxlint parses no `.astro` file and oxfmt loads no Prettier plugin.

- `lint` and `lint:fix` are overridden back to `eslint`, and every other file takes oxfmt
- Its `.oxfmtrc.json` repeats base's options because scan takes a child config over the parent's whole file
- `configs/src/components/dev/scenarios.astro` is a query-parameter switcher between candidate treatments, shipped under the application-code proof

### `tooling/web/`

Holds the layer that ships the capture harness, the served port, and a stub design index. Its `verify.yml` shadows base's seed, so a web target receives every change to it. The harness `e2e/screenshot.ts` is a config that loads `CASES` and `EVIDENCE_ROOT` from the seed `e2e/capture/cases.ts`, copied once, and exits 1 when it is missing.

- `configs/scripts/worktree-port.sh` prints a base plus an offset hashed from the worktree folder name, and refuses a leftover folder under `.claude/worktrees/` whose `.git` is gone
- Every manifest script calling the helper guards it with `&& export VAR &&`, because an assignment prefix discards the substitution's exit status
- A case flagged `evidence: true` lands under `EVIDENCE_ROOT` (default `e2e/evidence`), and the toolkit's own `web/e2e/capture/cases.ts` feeds `capture-home.sh`
- `configs/scripts/screenshot.sh` builds, previews, and polls, and its `EXIT` trap kills the preview by pid and by port, as `src/tooling/screenshot-trap.test.ts` exercises
- `bun run screenshot` shoots the running app, where `canon capture` in `src/capture/render.ts` drives Chromium over static HTML files

### `tooling/base/configs/`

Holds the repository-root configs, including the verify runner, and every `--skip base` subtree relies on the split they draw.

- Repo-root-once configs live in `base` and per-root configs in `web` and the adapters, so a per-root config moved into `base` breaks the split unless `base` names it under `[sync] per_root`
- `resolveChain` keeps a skipped stack carrying that key as a restricted manifest with those configs only, and `buildToolingReport` restores it so `canon sync --check` still measures them
- Syncing a subtree without `--skip base` re-drops husky per subtree, and git honors one `core.hooksPath`, so the extra hook directories break silently
- `scripts/verify.ts` runs the phases the nearest `scripts/verify.json` requires, and `check:format` and the `shell` add-on's `check:shell` run only where `package.json` declares the script
- A missing `package.json` in a subfolder verify tells the caller to sync the stack, and a missing `verify.json` names `canon tooling sync`

### `tooling/base/seeds/`

Holds the files every project starts with and then owns.

- Base's `verify.yml` and PR template are seeds because a polyglot target extends them, so a later change to either reaches no installed target, as `canon tooling diff` compares seeds for presence only
- `configPaths` shadows a seed at a path a stack ships as a config, and a seed is copy-once, so re-seeding a structured file means deleting it and syncing again
- Per-stack `ci.md` and `development.md` seeds are not shipped, and each stack reference carries a `## CI docs (extend)` section telling the agent which rows to append
- `seedIndependence` in `src/gate/boundaries.ts` fails on seed markdown naming the toolkit binary, so a seed describes an optional capability instead
- `capabilitySeeding` fails a hook, workflow, or husky script with no seed unless the file carries a `canon-no-seed:` comment, and it compares filenames only

### `tooling/claude/`

Is storage for `canon claude` and no stack, so `EXCLUDED_STACKS` in `src/tooling/manifest.ts` keeps it out of discovery.

- A seed exempts itself from the section check with `stub: true`, which `src/tooling/seed-marker.ts` strips on both install paths
- `planSeeds` in `src/claude/seeds.ts` iterates a literal `SUBDIRS` array, so a new claude seed folder needs its entry, an `install-check.ts` assertion, and a `canon claude init` run

### `src/tooling/`

Owns the manifest walk, scan, injection engine, stamp, reference resolver, and verify. The stamp keeps a standalone add-on such as `shell` or `public` beside the core chain, so syncing one never displaces the stack it layers onto.

- `scan` walks the current stack first and a file seen there blocks the same path from every parent, so dependencies and gitignore entries alone resolve from the furthest ancestor inward
- `mergeSections` writes a group header only when the whole group is missing, treats `.canon/tmp` and `.canon/tmp/` as one entry, and never rewrites a line
- `resolveWriteMode` in `src/commands/tooling.ts` maps `--check` to report, `--write` to apply, and a TTY to a prompt, and a headless caller with neither flag reports and exits 1
- `canon tooling diff` dispatches into `runSync` with `check` set and exits 1 on any difference, and `--json` answers `{ ok: false, reason, message }` on a refusal
- A target below its git toplevel syncs as a subfolder and withholds every `.github/` file. Sync writes a missing `package.json` only when the chain declares an install

### `src/tooling/disposition.ts`

Holds the decline, customize, and lift transitions over `domains.tooling.dispositions` in the stamp. `scan` and both injectors read that record, so a held path is never written.

- `recordToolingChain` hashes each config the target matches, and `scan` reads a drifted config against that hash as `stale`, `edited`, or `unattributed`
- `sync --write` replaces only a stale config and holds the rest until `--replace` names them, while `canon tooling inject` holds nothing
- A config no recorded stack ships is never held, since a fresh scaffold ships its own copies and `canon init` records `base` before `target-setup` syncs the framework stack
- `putDomain` rebuilds a record from the fields it knows, so a release older than the dispositions field drops it on its next tooling write and restores a declined file

### `src/tooling/install.ts`

`installDevDependencies` is the one place canon runs the package manager. It bounds `bun add -D` at 120 seconds and returns a refusal rather than throwing.

- A refusal carries reason `install-timeout` or `install-failed`, leaves the configs and seeds written, and skips the scripts, the gitignore merge, and the stamp, so the next sync retries
- Test a stall with a local TCP server that accepts and never replies, since a dead port fails at once with `ConnectionRefused`

### `src/tooling/verify-stack.ts`

Runs `canon tooling verify <stack>` by scaffolding into `.canon/tmp/runs/verify-<stack>/`, running `[verify] prepare`, syncing, then running `lint:fix`, `format`, `check`, `test:e2e`, and `screenshot` with `CI` set.

- A failed phase is recorded and the run continues, a scaffold with no `package.json` after sync fails it, and `--keep` preserves a green run
- The sync phase runs `bun <root>/src/cli.ts` from the checkout, never `canon` on PATH
- `web` has no scaffold command, so a change to `tooling/web/configs/` is verified through `vite-react` and `astro`
- Run it after any change to `tooling/<stack>/configs/`, a manifest, or `src/tooling/`
- Install Playwright browsers from the scaffold's `node_modules/.bin/`, since `web` leaves `@playwright/test` unpinned and a scaffold can resolve a newer release than this checkout's

### Other folders

A few checks and finders sit beside the engine.

- `tooling/*/reference.md` carries only what a config cannot express
- `renderStackSections` in `src/tooling/read.ts` appends `## Sync` and `## Gitignore` to a printed reference, read from that stack's own manifest and folders
- `ignoreParity` in `src/gate/boundaries.ts` fails when the repository `.gitignore` and the claude manifest disagree on `.canon/` or `.claude/worktrees/`, with no exception
- A folder committed on purpose, such as `.claude/canon/`, belongs in neither list, and `diagrams` stays in `DEFAULT_FOLDERS` and `BACKED_FOLDERS` though a target ignores it
- `seedRoots` in `src/tooling/seeds.ts` finds each `tooling/<stack>/seeds/` carrying `.claude/` or `canon/` for the seed gate

## Gotchas

- `Bun.Glob` skips dotfiles unless `dot: true` is set, and tooling configs are mostly dotfiles, so omitting it matches 4 of 14 files in `base`
- Commit golden config changes with `--no-verify`, since lint-staged runs against the template files themselves
- A bare `canon` on PATH resolves `PROJECT_ROOT` to the installed package, so `create`, `inject`, `list`, and `prune-gitignore` warn when it differs from the checkout
- The astro golden config's `@` alias resolves against the process cwd, so run astro from the project root and never with `--root <subdir>`
- Two seed sources writing one destination let install order pick the content, since `canon init` runs base before the Claude domain and `pendingSeeds` skips an existing path
