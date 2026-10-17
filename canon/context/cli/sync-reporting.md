---
title: Sync reporting
description: Attribution from git history, the freshness report, and the report sections covering what the drift walk cannot see
---

# Sync reporting

`canon sync --check` and the attribution fallback both read the plan `canon/context/cli/sync.md` describes rather than a second one. This file holds how an unstamped file is attributed, what the freshness report measures, and the sections it prints beside the domain scan.

## Decisions

### Freshness

`canon sync --check` reports drift and writes nothing. It reads the same `planSync` a sync would apply, so the report cannot disagree with the action it predicts.

Drift between syncs is normal, so the check exits 0 by default and CI opts into failing with `--exit-code`.

### Each domain has its own anchor

Each domain bounds its upstream read by its own anchor and toolkit source path, so `governance/rules/` commits are measured from when governance last synced rather than from whatever synced most recently.

Plugin skills under `claude/` are never copied into a target and load live, so they cannot go stale. New ones appear in a read-only section measured from the oldest anchor across domains, since over-reporting a skill costs a line while measuring from the newest would hide one.

### Tooling renders its own section

It prints whether it was measured before it prints any count. A target with no chain recorded produces the same zero a current target does, so naming the state is the section's whole reason to exist.

It stays out of `hasDrift` on the seeds grounds, since a golden config is one a project is expected to edit and a job counting it stays red with no remedy. Being unmeasured is not the reason, because an unmeasured report carries zero changes and would pass a count either way.

### The closing line names unstamped domains

The report closes by naming the scanned domains a target has left unstamped. Tooling is excluded there despite being a stamp domain, since its section renders on every managed target and a second mention states one fact under two remedies.

A scanned domain nobody installed has no section at all, which is what the closing line is for.

### Attribution from git history

An unstamped file falls back to the toolkit's git history, matching installed content against every version that path ever held in `src/sync/history.ts`. A match recovers `stale` and names the commit.

The stamp records what was installed, and history holds the same fact for anyone who installed before the stamp existed.

### Reconstructing keeps the refusal

No match means the content matches nothing the toolkit ever published, which is a local edit and stays `drifted`. A shipped ledger of per-release hashes would also cover a registry install, and lost as a generated artifact plus a drift stage carried forever, for a state each target leaves permanently on its next sync.

### One log call per domain

The fallback reads history as one `git log --raw` call per domain rather than one per file, and computes git's blob name locally instead of shelling into `hash-object`.

A repository normalizing line endings on checkout stores blobs the working tree never holds, so the local computation can miss. It fails toward `drifted`, the label that refuses.

### History is absent where the stamp is

A registry install ships `src/` without `.git`. `historyUnavailable` separates a toolkit that could not attribute from one that attributed and found a local edit, since only the first is a capability the install lacks.

It degrades the way `toolkitCommit` already does rather than failing the sync.

### Surfaces reported without a change

Seven report sections sit outside the domain scan in `src/sync/check.ts`, each covering something `planSync` structurally cannot.

- `seeds`, `superseded`, `unmigrated`, and `unmovedSurfaces`
- `newSkills`, described under the section built from it
- `newRules` and `reverse`, covered in `canon/context/cli/sync-reporting-rules.md`

All seven are report-only.

### Why report-only

Five are built on installed files. The engine turns a difference into a `copy` and a retired surface into a `delete`, and those files hold content the project wrote.

`newRules` and `newSkills` are report-only on the opposite ground, since both name files the target does not hold at all. Installing a rule changes what the project is governed by, and a skill loads live from the plugin directory with nothing to install.

### The managed-target gate

All seven are gated on `isManagedTarget`, which reads a `.claude/` directory, a `CLAUDE.md`, or a detected unmigrated domain. Seeds motivate it, since they enumerate from the source and an unmanaged directory would report every seed as `missing` and route to a section-merge skill.

The three scanned domains stay quiet regardless, since `installedStampDomains` gates them on an install marker.

### Why unmigrated counts as a marker

`detectUnmigrated` fires only on root files whose basename the toolkit ships, so firing proves the toolkit installed there before the layout moved.

An unmanaged target returns every section empty rather than only suppressing the render, so no consumer, one reading the JSON directly included, can act on a finding the render withheld.

### Seeds

Seeds get their own reader in `src/sync/seeds-report.ts` rather than a `SyncAdapter`. Two things blocked the adapter.

- `listInstalled` globs `**/*.md` under one root, while seeds span the target root for `CLAUDE.md` and `.claude/` for the rest, and include a `.json` and four `.sh` files
- `planSync` queues a copy for every non-matching file, which would overwrite `CLAUDE.md` wholesale and defeat the hand merge a drifted seed needs

### The seeds reader reuses history

It reuses `readHistoryIndex` and `findInstalledOrigin` directly, because `recoverAttribution` is private to the engine and takes an adapter seeds cannot supply.

Seeds carry no stamp, so `customized` is unreachable and an unattributed difference stays `drifted`.

### Superseded artifacts

`collectSuperseded` in `src/sync/layout.ts` derives retired artifacts by pairing `SUBDIRS` from `src/claude/seeds.ts` against an uppercase-stem sibling.

The `collectRetired` adapter hook was the wrong tool. It exists for `.claude/GOV.md`, a generated file, and the engine deletes whatever it returns. Deriving from the seed tree covers a folder added later without a code change, at the cost of missing a suffixed variant like `TASKS-ARCHIVE.md`.

### Unmigrated domains

`detectUnmigrated` covers a state the drift walk reads as clean. `installedStampDomains` lists only domains whose install marker exists, so a project holding `standards/` at its root would otherwise report zero entries for a real problem.

It counts toward `--exit-code` because the relocation closes it, while superseded artifacts and seed drift are excluded for the reason `orphaned` already is.

### The section is empty today

`ROOT_LAYOUTS` in `src/sync/layout.ts` is empty, since standards closed the install channel that put it at risk. The section stays, since the next domain to retire an install channel this way reoccupies it.

### Surfaces at the old root

`detectUnmovedSurfaces` in `src/sync/layout.ts` names each entry of `SURFACE_ENTRIES` that `surfaceDir` still resolves under `.claude/`, which happens only when the `.claude/` copy exists and the `canon/` one does not. The render points at `canon migrate surface-roots`. <!-- canon-keep-surface-root -->

A rule globs the `canon/` spelling alone, so a target on the old root stops loading the rules scoped to those files, and this section tells it.

### Why not `unmigrated`

`unmigrated` could not carry it, since `ROOT_LAYOUTS` models a domain stranded at the project root under a stamp domain and a surface has neither. Without the section the only signal was the `seeds` line reporting `.claude/REQUIREMENTS.md (drifted)`, which reads as content to refresh rather than a layout to move. <!-- canon-keep-surface-root -->

It stays out of `--exit-code` like `superseded`. A target gating CI on the count would go red on a move nobody scheduled, and the line is a prompt rather than a gate.
