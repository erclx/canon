---
title: Sync reporting
description: Attribution from git history, the freshness report, and the report sections covering what the drift walk cannot see, from seeds to the reverse walk
---

# Sync reporting

`canon sync --check` and the attribution fallback both read the plan `canon/context/cli/sync.md` describes rather than a second one. This file holds how an unstamped file is attributed, what the freshness report measures, and the sections it prints beside the domain scan.

## Freshness

`canon sync --check` reports drift and writes nothing. It reads the same `planSync` a sync would apply, so the report cannot disagree with the action it predicts. Drift between syncs is normal, so the check exits 0 by default and CI opts into failing with `--exit-code`.

Each domain bounds its upstream read by its own anchor and its own toolkit source path, so `governance/rules/` commits are measured from when governance last synced rather than from whatever synced most recently. Plugin skills under `claude/` are never copied into a target and load live, so they cannot go stale. New ones appear in a separate read-only section read from the oldest anchor across domains, since over-reporting a skill costs a line while measuring from the newest would hide one.

Tooling renders its own section, and it prints whether it was measured before it prints any count. A target with no chain recorded produces the same zero a current target does, so naming the state is the whole reason the section exists. It stays out of `hasDrift` on exactly the seeds grounds, since a golden config is one a project is expected to edit and a job counting it stays red with no remedy. Being unmeasured is not the reason, because an unmeasured report carries zero changes and would pass a count either way.

The report closes by naming the scanned domains a target has left unstamped. Tooling is excluded there despite being a stamp domain, because its section renders on every managed target and a second mention states one fact under two remedies. A scanned domain nobody installed has no section at all, which is what the closing line is for.

## Attribution from git history

An unstamped file falls back to the toolkit's git history, matching installed content against every version that path ever held in `src/sync/history.ts`. The stamp records what was installed, and history holds the same fact for anyone who installed before the stamp existed, so a match recovers `stale` and names the commit.

Reconstructing rather than trusting is what keeps the fallback from softening the refusal. No match means the content matches nothing the toolkit ever published, which is a local edit and stays `drifted`. A shipped ledger of per-release hashes was the alternative, and it would also cover a registry install. It lost as a generated artifact plus a drift stage carried forever, for a state each target leaves permanently on its next sync.

The fallback reads history as one `git log --raw` call per domain rather than one per file, and computes git's blob name locally instead of shelling into `hash-object`. A repository normalizing line endings on checkout stores blobs the working tree never holds, so the local computation can miss. It fails toward `drifted`, which is the label that refuses.

History is absent exactly where the stamp is, since a registry install ships `src/` without `.git`. `historyUnavailable` separates a toolkit that could not attribute from one that attributed and found a local edit, because only the first is a capability the install lacks. It degrades the way `toolkitCommit` already does rather than failing the sync.

## Surfaces reported without a change

Six report sections sit outside the domain scan in `src/sync/check.ts`, being `seeds`, `superseded`, `unmigrated`, `newSkills`, `newRules`, and `reverse`, each covering something `planSync` structurally cannot. The headings below carry five of them, since `newSkills` is described under the section built from it. All six are report-only, and the reason holds for the four built on installed files: the engine turns a difference into a `copy` and a retired surface into a `delete`, and those files hold content the project wrote. `newRules` and `newSkills` are report-only on the opposite ground, since both name files the target does not hold at all. Installing a rule changes what the project is governed by, and a skill loads live from the plugin directory with nothing to install.

All six are gated on `isManagedTarget`, which reads a `.claude/` directory, a `CLAUDE.md`, or a detected unmigrated domain. Seeds motivate the gate: they enumerate from the source rather than from what a target installed, so without it an unmanaged directory would report every seed as `missing` and route to a section-merge skill, while the three scanned domains would correctly stay quiet regardless, since `installedStampDomains` already gates them on an install marker.

An unmigrated domain counts as a marker because `detectUnmigrated` fires only on root files whose basename the toolkit ships, so it firing proves the toolkit installed there before the layout moved. An unmanaged target returns every section empty rather than only suppressing the render, so no consumer, `canon-operator` reading the JSON directly included, can act on a finding the render withheld.

### Seeds

Seeds get their own reader in `src/sync/seeds-report.ts` rather than a `SyncAdapter`. Three things blocked the adapter. `listInstalled` globs `**/*.md` under one root while seeds span the target root for `CLAUDE.md`, `.claude/` for the rest, and include a `.json` and four `.sh` files. And `planSync` queues a copy for every non-matching file, which would overwrite `CLAUDE.md` wholesale and defeat the section merge `seed-sync` exists to run.

The reader reuses `readHistoryIndex` and `findInstalledOrigin` directly, because `recoverAttribution` is private to the engine and takes an adapter seeds have no way to supply. Seeds carry no stamp, so `customized` is unreachable and an unattributed difference stays `drifted`.

### Superseded artifacts

`collectSuperseded` in `src/sync/layout.ts` derives retired artifacts by pairing `SUBDIRS` from `src/claude/seeds.ts` against an uppercase-stem sibling. The existing `collectRetired` adapter hook was the wrong tool: it exists for `.claude/GOV.md`, a generated file, and the engine deletes whatever it returns. Deriving from the seed tree rather than a fixed filename list means a folder added later is covered without a code change, at the cost of missing a suffixed variant like `TASKS-ARCHIVE.md`.

### Unmigrated domains

`detectUnmigrated` covers a state the drift walk alone reads as clean: `installedStampDomains` lists only domains whose install marker exists, so a project holding `standards/` at its root would otherwise report zero entries for a real problem. It counts toward `--exit-code` because the relocation closes it, while superseded artifacts and seed drift are excluded for the reason `orphaned` already is. `ROOT_LAYOUTS` in `src/sync/layout.ts` is empty, since standards and snippets have both closed the install channel that put either at risk of sitting unmigrated at a project root, so the section currently names no domain. The section stays rather than being cut, since the next domain to retire an install channel this way reoccupies it.

### Rules the target never received

`readNewRules` answers the question the drift walk cannot ask. That walk enumerates what the target holds, so a rule that never arrived sits in no section and the report reads clean. A sync can silently refresh a rule into a version that cites a sibling rule the target never received, such as `800-prose` citing `801-markdown`, which needs a hand repair once discovered.

Reporting was chosen over installing. A sync that adds rules silently changes what a project is governed by, and nobody chose that, so the install stays a separate command an operator runs. The cost is that a target can read the section and act on none of it, which is the same contract `newSkills` already sets.

A recorded chain is read first, through `resolveMissingRules` in `src/gov/stacks.ts`. It compares the target's current tree against `resolveRules(root, chain[0])` and needs no anchor at all, which is what makes it immune to the gap the fallback below carries: a rule that joined the stack before the target's governance anchor is not a permanent blind spot, since the anchor never enters the read. `collectMissing` on the gov adapter runs the same function, so `canon gov sync` reports a `missing` entry per file for exactly what this section names by list.

The diff-and-bands fallback below is what a target stamped before governance recorded a chain still gets. `readNewSkills` was the model for it, since both diff the toolkit's own tree from an anchor and list what appeared. Two things diverge. Skills are not domain-scoped, so that read takes the oldest anchor across domains, where rules are scoped and this one takes governance's own `stampedCommit`, since a shared anchor would let another domain's sync advance the revision rules are measured from. And skills need no filter, where an unfiltered rule list reports what a base consumer can never receive.

The fallback's entitlement filter reads two sources. The base stack's whole-folder entries are entitled to every target, since every stack extends base, and that is the only thing covering a band added to base later, which exists in no installed tree and would otherwise reach nobody. Everything else is read off the target's band folders, which is the only evidence a target with no recorded chain leaves of what it was entitled to. One band is reachable from more than one stack, so the test over-reports inside a folder the target already holds, taken over under-reporting because a missed rule costs the section its whole point.

An unresolvable anchor is a gap the fallback still carries. `read` returns an empty string on a non-zero exit, so a stamp naming a revision the running clone has never seen produces an empty list that reads exactly like a target holding everything. The per-domain scan met the same failure and answered it with `historyUnavailable`, which separates a toolkit that could not measure from one that measured and found nothing. Neither `newRules` nor `newSkills` carries that flag, so both are quiet in the one case the section's argument says a reader must not over-read. Adding a third state was declined here as a change to a shipped sibling's shape rather than to this row, and the docs page names the limit instead. The chain-based read above is untouched by this gap, since it consults no anchor.

`held` drops a rule by name before the fallback's band test runs. A rule the toolkit moved between bands reaches this diff as an addition, since `--diff-filter=A` sees a rename as one, and the name is what tells that apart from a rule the target never had. The chain-based read gets the same protection from `installedRuleNames`, which matches by basename regardless of which band folder the target's copy sits in.

`bands` and the chain-based read's entitlement check share a source that looks unrelated: `INSTALL_MARKERS.governance` in `src/sync/check.ts`. `installedStampDomains` reads it as a presence check, and `readInstalledRules`'s `bands` derivation walks the same directory and takes each installed file's top-level segment as its domain band.

`bands` and `INSTALL_MARKERS.governance` must move together: leaving `INSTALL_MARKERS.governance` at a stale root would have `bands` reporting the root's own top segment (such as `["canon"]`) in place of real domain names like `["claude", "ui"]`, silently breaking the entitlement filter above for any target still on this fallback path. A change to one adapter's `installedRoot` is a change to `INSTALL_MARKERS` for the same domain too, since nothing else keeps the two in step.

Nothing here reaches `hasDrift`. `unmigrated` counts because running the relocation closes it, and a command closes this too, so the exclusion rests on consent rather than on the absence of a remedy: gating CI on the count would pressure a target into adopting rules nobody picked.

### The reverse walk

`src/sync/reverse.ts` is the only section built by walking the target rather than the catalog. It reports beside `superseded`, `unmigrated`, and `newSkills` rather than absorbing them. Each of those answers a narrower version of the same question and none is wrong today, so folding them in would change what two shipped sections print in the same change that introduces a third. A later consolidation can read one interface instead of inventing it.

The candidate set is read from history rather than declared. `readDroppedRoots` takes one `git log --all --diff-filter=D --name-only` over the whole repository and keeps every top-level path that records a deletion and no longer exists in the working tree. Both halves are load-bearing: a path with deletions that still exists is a live root the forward direction already covers, and a path that never lost a file was never dropped. Scoping to those roots is what separates a useful finding from a listing of the project, since walking the whole tree reports every project folder as unclaimed.

Attribution reuses `findInstalledOrigin` rather than a second history reader, and it keys on the path the toolkit once held under that root. Only files whose relative path appears in the index are hashed, so a project folder colliding on a retired name costs no reads.

Three verdicts come out of that one pass. Content matching a published blob is `dropped` and names the commit. A path the toolkit shipped holding content it never published is `unattributed`, which is what history proving nothing looks like rather than a weak `dropped`. No path overlap at all is `project`, and the render drops those while the JSON keeps them, since a name collision printed on every run is a line no remedy closes.

The walk reaches none of that on an unmanaged target. `isManagedTarget` gates it the way it gates its three siblings, and the early branch returns `emptyReverseReport()`, so a project holding a dropped root reports nothing unclaimed until it carries a `.claude/` directory, a `CLAUDE.md`, or an unmigrated domain. A consumer staging a folder to observe the walk stages the marker too, or it reads an empty section as a clean answer.

### What reaches the exit code

Nothing in the reverse section reaches `hasDrift`. Every entry is a judgment about a file the project may own, and one verdict is a labelled unknown by design. The sandbox `unclaimed` arm asserts the exit code stays 0 with a finding present.

The arm restores a dropped file at its published bytes rather than writing one by hand, because content is what the attribution matches on and a hand-written file would assert the wrong verdict. Both of its history reads take the listing through a process substitution rather than a pipeline ending in an early exit, for the reason `canon/context/sandbox/authoring.md` states over every scenario file.
