---
title: Manifests and layering
description: Manifest blocks and what each injects, which layer wins a duplicate, gitignore merging, the ignore-parity check, and subfolder and monorepo sync
---

# Manifests and layering

## Overview

Each stack's `manifest.toml` controls what sync injects, and the extends chain decides which layer's file a target receives. `internal/rules/claude/tooling-reference.md` carries the syntax invariants and the manifest-to-reference symmetry.

It globs `tooling/*/manifest.toml` beside `tooling/*/reference.md` so an edit to either side loads both, since the manifest is the side that moves first. `internal/standards/tooling-reference.md` carries the symmetry in prose.

## Layout

### Manifest blocks

`[stack]` is the only required block.

```toml
[stack]
name = "stack-name"     # must match the folder name under tooling/
extends = "parent"      # parent stack to inherit from, empty string if none
runtime = "runtime-name"      # reserved, read by nothing
scaffold = "scaffold-command"  # bootstrap command, read by sandbox/tooling/upstream.ts
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

Each block injects one thing.

| Block                | Injects                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `[dependencies.dev]` | into `devDependencies`, adding only missing packages                                                                                                               |
| `[scripts]`          | into `scripts`, adding only missing keys                                                                                                                           |
| `[gitignore]`        | each group as a comment header plus one line per path, with single-word labels such as `# VSCode` so headers stay stable across renames                            |
| `[verify] prepare`   | a post-scaffold, pre-sync command for `canon tooling verify`, for an integration that cannot ship as a golden config, such as astro's `bunx astro add react --yes` |

### Gitignore merging

`mergeSections` in `src/tooling/gitignore.ts` writes a group's header only when the whole group is missing from the target. A group the target already carries takes its new entries bare at the end of the file, so an entry added to a shipped group reaches an already-scaffolded project detached from its header.

Presence is re-tested against the growing file and ignores a trailing slash, so `.canon/tmp` and `.canon/tmp/` count as one entry.

## Decisions

### Which layer wins

Stack-specific configs override the extends chain. `scan` in `src/tooling/scan.ts` walks the current stack first, and a file seen there blocks the same relative path from every parent layer.

Which stack wins a duplicate differs by category, and the split is inherited. Configs, seeds, and scripts resolve nearest stack first, while dependencies and gitignore entries resolve from the furthest ancestor inward. The TypeScript port preserved both directions, because unifying them would silently change what a target receives.

### Merges that add and never rewrite

Gitignore merging is additive only and existing entries are never touched, so a project can reorder or annotate its own ignores without sync fighting it. A seed copies once and is then left alone.

### The ignore-parity check

Both the repository `.gitignore` and the claude manifest's list carry `.canon/` and `.claude/worktrees/`. A target that syncs and never runs `canon migrate records` stops ignoring records still under `.claude/`.

The Ignore parity measure in `src/gate/boundaries.ts` gates `bun run check` rather than reporting, because the manifest reaches every target on the next sync and a drift between the two lists surfaces to nobody.

- It reads the whole file rather than one header, since a claude-scoped entry filed under a header of its own would read as missing
- It drops the trailing slash so either side may omit one, and matches `.canon` as a bare root as well as a prefix
- The comparison reads a closed set in both directions and is blind to a folder a shipped command creates that neither file names
- A folder whose contents are committed on purpose belongs in neither, which is why `.claude/canon/` is absent from both

No exception mechanism exists. The bare `.canon/` spelling admits no carve-out, and written as `.canon/*` a negation reaches only the folder it names, at one line per tracked folder.

`diagrams` stays in `DEFAULT_FOLDERS` in `src/context/folders.ts` and in `BACKED_FOLDERS` in `src/records/backup.ts`, so the audit still covers it and `canon records push` carries it though a target ignores it.

### Monorepo sync

Syncing a monorepo subtree without `--skip base` re-drops husky per subtree, and git honors only one `core.hooksPath`, so the extra hook dirs silently break.

`--skip base` relies on the layer boundary holding. Repo-root-once configs live in `base`, and per-root configs live in `web` and the adapters, so moving a per-root config into `base` breaks the split unless base names it under `[sync] per_root`.

- `[sync] per_root` is that one named exception, and base lists its verify runner and phase list there
- `resolveChain` keeps a skipped stack carrying the key as a restricted manifest, holding those configs and no seeds, scripts, dependencies, or gitignore entries
- `scan`, `injectConfigs`, and `tooling diff` agree through `configFiles` and `seedFiles`
- The chain stamp leaves the restricted stack out, and `buildToolingReport` restores it by re-resolving the recorded leaf with the first unrecorded ancestor as the skip
- `canon sync --check` then measures the per-root files in a skipped subfolder without flagging every config the skip withheld

### Subfolder detection

A target below its git toplevel syncs as a subfolder, read in `src/tooling/subfolder.ts` by comparing `git rev-parse --show-toplevel` against the target's realpath. A target outside any repository reads as a root.

- Every `.github/` config or seed moves into the scan's `withheld` field and stays out of `totalChanges`, since GitHub reads workflows only at the root
- `scan`, `injectConfigs`, and `injectSeeds` all call `isWithheldInSubfolder`, so the diff and the write cannot disagree
- A sync into a folder with no `package.json` installs the gitignore alone and warns with every dependency and script it skipped, rather than seeding a `package.json` that picks a manager and name

### Verify phases in a subfolder

Base's `scripts/verify.ts` runs a phase the nearest `scripts/verify.json` requires and fails when its script is undeclared.

- A base-owned phase the list leaves out, being `check:format`, runs only where `package.json` declares its script
- The `shell` add-on's `check:shell` runs on the same terms after probing for `shfmt` and `shellcheck`
- So web, python, go, and php pass in a `--skip base` subfolder while base alone fails on a missing one
- A missing `package.json` names `bun init`, and a missing `verify.json` names `canon tooling sync`

## Gotchas

### Manifest and glob traps

Five details fail silently or surprise a first reader.

- `runtime` is reserved and read by nothing. `scaffold` is read only by `sandbox/tooling/upstream.ts`, not by `canon tooling sync`.
- Bun's script shell expands command substitution and a leading environment assignment, so a script value may carry `VAR=$(bash scripts/x.sh) command`. Verified 2026-08-13 against `bun run`.
- `Bun.Glob` skips dotfiles unless `dot: true` is set. Tooling configs are almost entirely dotfiles, so omitting it matches 4 of 14 files in `base` and fails silently.
- Seeds are copy-once. To re-seed a structured file, delete it and sync again.

### File modes

Sync keeps executable bits.

- `copyPreservingMode` in `src/sync/copy.ts` keeps a destination's mode, per `internal/rules/core/operator-files.md`, so a target's husky hooks keep their executable bit across a sync
- It sits in `src/sync/` because the sync engine owns it and the tooling inject reads it
