---
title: Sync reporting for rules and the reverse walk
description: The newRules section, its chain and fallback reads, and the reverse walk that finds files the toolkit dropped
---

# Sync reporting for rules and the reverse walk

Two sections of `canon sync --check` read the target against the toolkit rather than the other way around. `canon/context/cli/sync-reporting.md` carries the freshness report and the other sections.

## Decisions

### Rules the target never received

`readNewRules` answers what the drift walk cannot ask. That walk enumerates what the target holds, so a rule that never arrived sits in no section and the report reads clean.

A sync can refresh a rule into a version that cites a sibling the target never received, such as `governance/rules/writing/markdown.md` citing a sibling rule, which needs a hand repair once discovered.

### Reporting beat installing

A sync that adds rules silently changes what a project is governed by, and nobody chose that, so the install stays a separate command an operator runs.

The cost is that a target can read the section and act on none of it, the contract `newSkills` already sets.

### A recorded chain is read first

`resolveMissingRules` in `src/gov/stacks.ts` compares the target's current tree against `resolveRules(root, chain[0])` and needs no anchor at all. A rule that joined the stack before the target's governance anchor is not a blind spot, since the anchor never enters the read.

`collectMissing` on the gov adapter runs the same function, so `canon gov sync` reports a `missing` entry per file for exactly what this section names by list.

### The diff-and-folders fallback

A target stamped before governance recorded a chain gets the fallback. `readNewSkills` was its model, since both diff the toolkit's own tree from an anchor and list what appeared. Two things diverge.

- Skills are not domain-scoped, so that read takes the oldest anchor across domains, where this one takes governance's own `stampedCommit`
  - A shared anchor would let another domain's sync advance the revision rules are measured from
- Skills need no filter, where an unfiltered rule list reports what a base consumer can never receive

### The entitlement filter reads two sources

A folder holding a rule the base stack resolves to is entitled to every target, since every stack extends base. That is the only thing covering a rule folder base reaches later, which exists in no installed tree.

Everything else is read off the target's rule folders, the only evidence a target with no recorded chain leaves. One rule folder is reachable from more than one stack, so the test over-reports inside a folder the target already holds, taken over under-reporting because a missed rule costs the section its whole point.

### An unresolvable anchor is a known gap

`read` returns an empty string on a non-zero exit, so a stamp naming a revision the running clone has never seen produces an empty list that reads like a target holding everything.

The per-domain scan answered the same failure with `historyUnavailable`. Neither `newRules` nor `newSkills` carries that flag, so both are quiet in the one case a reader must not over-read.

### The gap stays named

A third state was declined as a change to a shipped sibling's shape rather than to this row, so the docs page names the limit. The chain-based read consults no anchor and is untouched.

### `held` runs before the folder test

`held` drops a rule by name before the fallback's folder test. A rule the toolkit moved between rule folders reaches the diff as an addition, since `--diff-filter=A` sees a rename as one, and the name tells that apart from a rule the target never had.

The chain-based read gets the same protection from `installedRuleNames`, which matches by basename regardless of which folder holds the target's copy.

### `folders` and the install marker move together

`folders` and the chain-based entitlement check share a source that looks unrelated, `INSTALL_MARKERS.governance` in `src/sync/check.ts`. `installedStampDomains` reads it as a presence check, and `readInstalledRules`'s `folders` derivation walks the same directory and takes each installed file's top-level segment as its rule folder.

A stale `INSTALL_MARKERS.governance` root would have `folders` reporting the root's own top segment (such as `["canon"]`) instead of rule folder names like `["claude", "ui"]`, silently breaking the entitlement filter. A change to an adapter's `installedRoot` is a change to `INSTALL_MARKERS` too, since nothing else keeps the two in step.

### New rules stay out of `hasDrift`

`unmigrated` counts because running the relocation closes it, and a command closes this too, so the exclusion rests on consent rather than the absence of a remedy. Gating CI on the count would pressure a target into adopting rules nobody picked.

### The reverse walk

`src/sync/reverse.ts` is the only section built by walking the target rather than the catalog. It reports beside `superseded`, `unmigrated`, and `newSkills` rather than absorbing them.

Each of those answers a narrower version of the same question and none is wrong today, so folding them in would change what two shipped sections print in the change introducing a third. A later consolidation can read one interface instead of inventing it.

### The candidate set is read from history

`readDroppedRoots` takes one `git log --all --diff-filter=D --name-only` over the whole repository and keeps every top-level path that records a deletion and no longer exists in the working tree.

- A path with deletions that still exists is a live root the forward direction already covers
- A path that never lost a file was never dropped
- Scoping to those roots separates a useful finding from a listing of the project, since walking the whole tree reports every project folder as unclaimed

### Attribution reuses `findInstalledOrigin`

It keys on the path the toolkit once held under that root. Only files whose relative path appears in the index are hashed, so a project folder colliding on a retired name costs no reads.

### Three verdicts

One pass yields three outcomes.

- Content matching a published blob is `dropped` and names the commit
- A path the toolkit shipped holding content it never published is `unattributed`, which is what history proving nothing looks like rather than a weak `dropped`
- No path overlap at all is `project`, which the render drops and the JSON keeps, since a name collision printed on every run is a line no remedy closes

### An unmanaged target reports nothing

`isManagedTarget` gates the walk, and the early branch returns `emptyReverseReport()`. A project holding a dropped root reports nothing unclaimed until it carries a `.claude/` directory, a `CLAUDE.md`, or an unmigrated domain.

A consumer staging a folder to observe the walk stages the marker too, or it reads an empty section as a clean answer.

### What reaches the exit code

Nothing in the reverse section reaches `hasDrift`. Every entry is a judgment about a file the project may own, and one verdict is a labelled unknown by design. The sandbox `unclaimed` arm asserts the exit code stays 0 with a finding present.

### The sandbox arm restores real bytes

The arm restores a dropped file at its published bytes rather than writing one by hand, because content is what the attribution matches on and a hand-written file would assert the wrong verdict.

Both its history reads take the listing through a process substitution rather than a pipeline ending in an early exit, for the reason `canon/context/sandbox/authoring.md` states over every scenario file.
