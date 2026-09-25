---
title: Manifests and layering
description: Manifest blocks and what each injects, which layer wins a duplicate, gitignore and dictionary merging, the ignore-parity check, and subfolder and monorepo sync
---

# Manifests and layering

## Overview

Each stack's `manifest.toml` controls what sync injects, and the extends chain decides which layer's file a target receives. `internal/rules/claude/595-tooling-reference.md` carries the syntax invariants and the manifest-to-reference symmetry, globbing `tooling/*/manifest.toml` beside `tooling/*/reference.md` so an edit to either side loads both, since the manifest is the side that moves first. `internal/standards/tooling-reference.md` carries the symmetry in prose.

## Decisions

### Which layer wins

Stack-specific configs override the extends chain. `scan` in `src/tooling/scan.ts` walks the current stack first, and a file seen there blocks the same relative path from every parent layer.

Which stack wins a duplicate differs by category, and the split is inherited rather than designed. Configs, seeds, and scripts resolve nearest stack first, while dependencies and gitignore entries resolve from the furthest ancestor inward. The TypeScript port preserved both directions rather than unifying them, because unifying would silently change what a target receives.

### Merges that add and never rewrite

Gitignore merging is additive only and existing entries are never touched, so a project can reorder or annotate its own ignores without sync fighting it. Dictionary seeds merge rather than copy once: `.cspell/*.txt` accumulates project terms, so sync appends new entries and sorts. Every other seed copies once and is then left alone.

## Gotchas

- `runtime` is reserved and read by nothing. `scaffold` is read only by `scripts/sandbox/tooling/upstream.sh`, not by `canon tooling sync`.
- Bun's script shell expands command substitution and a leading environment assignment, so a script value may carry `VAR=$(bash scripts/x.sh) command`. Verified 2026-08-13 against `bun run`.
- `Bun.Glob` skips dotfiles unless `dot: true` is set. Tooling configs are almost entirely dotfiles, so omitting it matches 4 of 14 files in `base` and fails silently.
- Non-`.txt` seeds are copy-once. To re-seed a structured file, delete it and sync again.
- `copyPreservingMode` in `src/copy.ts` keeps a destination's mode, per `internal/rules/core/096-operator-files.md`. `tooling/web/configs/scripts/verify.sh` is 644 while base ships 755, so a copy applying the source mode would strip the executable bit on the `web` and `astro` chains. It sits at the top level rather than in `src/tooling/` because the sync engine needs the same guarantee.

### The ignore-parity check

Both the repository `.gitignore` and the claude manifest's list carry `.canon/` and `.claude/worktrees/`. A target that syncs and never runs `canon migrate records` stops ignoring records still under `.claude/`. `scripts/core/check-ignore-parity.sh` gates `bun run check` rather than reporting, because the manifest reaches every target on the next sync and a drift between the two lists surfaces to nobody.

It reads the whole file rather than one header, since a claude-scoped entry filed under a header of its own would read as missing. It drops the trailing slash so either side may omit one, and matches `.canon` as a bare root as well as a prefix, since a pattern outside the case the loop matches on passes having compared nothing.

The comparison reads a closed set in both directions and is blind to a folder a shipped command creates that neither file names. A folder whose contents are committed on purpose belongs in neither, which is why `.claude/canon/` is absent from both.

No exception mechanism exists. The bare `.canon/` spelling admits no carve-out, and written as `.canon/*` a negation reaches only the folder it names, at one line per tracked folder. `diagrams` stays in `DEFAULT_FOLDERS` in `src/context/folders.ts` and in `BACKED_FOLDERS` in `src/records/backup.ts`, so the audit still covers it and `canon records push` carries it though a target ignores it.

### Subfolder and monorepo sync

- Syncing a monorepo subtree without `--skip base` re-drops husky per subtree. Git honors only one `core.hooksPath`, so the extra hook dirs silently break.
- `--skip base` relies on the layer boundary holding: repo-root-once configs live in `base`, and per-root configs live in `web` and the adapters. Moving a per-root config into `base` would break the split.
- A target below its git toplevel syncs as a subfolder, read in `src/tooling/subfolder.ts` by comparing `git rev-parse --show-toplevel` against the target's realpath. Every `.github/` config or seed moves into the scan's `withheld` field and stays out of `totalChanges`, since GitHub reads workflows only at the root. `scan`, `injectConfigs`, and `injectSeeds` all call `isWithheldInSubfolder`, so the diff and the write cannot disagree. A target outside any repository reads as a root.
- A subfolder sync on a chain without `base` writes a nested `cspell.json` copy-once, registering each seeded `.cspell/*.txt` as `local-<basename>`. A root `cspell '**'` merges it for files under the subfolder. Reusing the root's `tech-stack` name shadows the root list there, so the prefix is required. Measured on cspell 8 only, and `cspell` is unpinned in the base manifest.
- The web, python, go, and php `scripts/verify.sh` run each base-owned phase, being `format`, `check:format`, `check:spell`, and `check:shell`, only when the folder's `package.json` declares its script, and stop naming `bun init` when no `package.json` exists. The stack-owned phases stay unguarded, so a missing stack script still fails.
- A sync into a folder with no `package.json` installs the gitignore alone and warns with every dev dependency and script it skipped, rather than seeding a `package.json` that would pick a package manager and a name for the target.

## Manifest blocks

`[stack]` is the only required block.

```toml
[stack]
name = "stack-name"     # must match the folder name under tooling/
extends = "parent"      # parent stack to inherit from, empty string if none
runtime = "runtime-name"      # reserved, read by nothing
scaffold = "scaffold-command"  # bootstrap command, read by sandbox/tooling/upstream.sh
```

```toml
[dependencies.dev]
packages = []

[scripts]
"script-key" = "command --flag"

[gitignore]
"# group-label" = ["pattern/", ".file"]

[verify]
prepare = "command to run after scaffold, before sync"
```

`[dependencies.dev]` injects into `devDependencies`, adding only missing packages. `[scripts]` injects into the `scripts` block, adding only missing keys. `[gitignore]` appends each group as a comment header plus one line per path, with single-word labels such as `# VSCode` so headers stay stable across renames. `[verify] prepare` declares a post-scaffold, pre-sync setup command for `canon tooling verify`, for an integration that cannot ship as a golden config, such as astro's `bunx astro add react --yes`.

`mergeSections` in `src/tooling/gitignore.ts` writes a group's header only when the whole group is missing from the target. A group the target already carries takes its new entries bare at the end of the file, so an entry added to a shipped group reaches an already-scaffolded project detached from its header. Presence is re-tested against the growing file and ignores a trailing slash, so `.canon/tmp` and `.canon/tmp/` count as one entry.
