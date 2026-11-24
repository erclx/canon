---
title: CLI sync
description: '`src/sync/`, `src/targets/`, and `src/migrate/`, being the sync engine and its install stamp, the machine-level target index, and the one-shot migrations'
---

# CLI sync

## Overview

Owns the sync engine `gov` installs and syncs through, the index of target projects, and the migrations behind `canon migrate`. The layers they stand on are in `canon/context/surfaces/cli/overview.md`.

## Layout

### `src/sync/`

Holds the one engine `gov` installs and syncs through, the workflow `canon sync` runs afterward, and the install stamp. `format.ts` formats the stamp alone with the target's `oxfmt` or `prettier`, since a formatted seed would read as `customized`. `stamp.ts` already writes the shape both accept.

- An adapter supplies `installedRoot`, `locateSource`, and optional hooks. Widen `SyncAdapter` rather than branching on a domain name in `engine.ts`
- `planSync` marks each walked file with a state such as `stale`, `orphaned`, `retired`, or `renamed`. Location decides ownership before a name lookup, through `projectSubdir` and `ownsInstalledRoot`
- Declare a rename in `governance/renames.toml`, or the old rule lands as `retired` and is deleted. `src/gov/renames.test.ts` fails on a live key, a dead chain, or a cycle
- `stamp.ts` writes `canon/config/config.json` after the copies land and reads three older spellings. Adding a domain means choosing `STAMP_DOMAINS` or `SCANNED_DOMAINS`, and retiring one edits both
- `check.ts` builds `canon sync --check`, `history.ts` recovers `stale` when unstamped, and `reverse.ts` finds dropped files. `hasDrift` skips `orphaned`, tooling, and the new and reverse sections

### `src/targets/`

Owns the machine-level index of target projects, kept under `stateDir()`.

- `registry.ts` records a target as `putDomain` stamps it, refuses a scratch path, and drops gone or scratch rows. A failed write is dropped
- `sweep.ts` finds installs that predate the index. It descends into a stamped folder, which can hold others, and skips `.claude` so a worktree's stamp copy counts nothing
- `resolve.ts` groups by origin so a target in two clones counts once, and `pulls.ts` reads each target's open pull requests
- `validate.ts` holds `resolveTarget`, the install-directory check under every verb that takes a target

### `src/migrate/`

Holds the one-shot moves behind `canon migrate`, being `records`, `surface-roots`, `record-tree`, `scratch-evidence`, `record-layout`, `rename`, `skill-names`, `rule-layout`, `session-defaults`, and `app-config`. Each plans first and applies only under `--write`. `session-defaults` plans hooks in `src/migrate/hook-wiring.ts`.

- `status.ts` orders every move in `MIGRATIONS` and reads each by its exit through `cliRunner`, and a test fails when a registered subcommand is missing from it, so a new move joins by one line there
- `rename.ts` holds the token sweep and `skill-names.ts` the map it reads, so a renamed or merged skill is a map row plus a pointer left at the old name
- A merged skill's pointer sets `disable-model-invocation: true`, counts as a shipped skill, and needs a routing case, `metadata.family`, and a skill-map row
- Each old spelling in the pointer takes a `canon-keep-retired` marker so a later sweep does not move it onto the survivor
- The pointer's paths join the map's `excludedPaths` only after the sweep runs, since excluding first leaves the real body unmoved while every citation names the new one
