---
title: Install stamp
description: The install stamp at canon/config/config.json, the machine-level target index it feeds, and which domains and paths the stamp covers
---

# Install stamp

The stamp is the record a sync reads to separate a file the toolkit moved from a file the project edited. `canon/context/cli/sync.md` carries the engine that writes and reads it.

## Decisions

### Why a stamp exists

A content hash answers whether a file changed. Only a record written at install time answers who changed it, and the two need opposite actions. That is why `canon/config/config.json` exists rather than recomputing against the source, which `planSync` already did.

### The path list is a second input to the walk

A relocated file is never walked, so a lookup keyed by the current path would never consult its entry and the stamp would buy nothing a recomputed hash does not. Folding stamped paths into the walk makes a move visible.

### Three sourceless states

| State      | Meaning                                              | Sync acts |
| ---------- | ---------------------------------------------------- | --------- |
| `orphaned` | Project-authored rule, never converges               | No        |
| `stranded` | Stamped file at a root the toolkit abandoned         | No        |
| `retired`  | The walked root is the toolkit's, so no stamp needed | Yes       |

Counting an orphan as drift left `--exit-code` failing forever with no remedy. A stranded file is a relocation waiting on a decision.

### The stamp writes after the copies land

A partial apply that throws leaves the previous stamp rather than a claim the target does not meet. A stamp that lies is worse than none, since the next report calls updated files stale.

### What `canon/config/` holds

It takes a loose config file the toolkit owns, plus `baseline.json`, the one generated file that outgrew its own folder. Installed content a project reads and edits keeps its own folder, which is `.claude/rules/`.

Ownership is not the test. Being a bare file in the shared root is, which the config and the baseline both satisfy.

### The target index

`putDomain` is the one place the machine-level target index is kept, since every install and sync that stamps a target passes through it and no install command has to remember. The index sits at `$XDG_STATE_HOME/canon/targets.json`, resolved by `stateDir` in `src/targets/registry.ts`.

Its `recordTarget` outcome is dropped deliberately. The stamp written a line above is the authoritative record, the index is a cache over every such stamp, and an unwritable state folder is no reason to fail a sync whose files already landed.

### The index records installs as they happen

A filesystem walk answers about the paths someone thought to name. A hand census run twice against one folder got both wrong, reporting six consuming projects across eight folders.

- Two folders had never been targets
- One was a second clone of a target already counted
- The clone a repair ran in sat outside the folder entirely

### The sweep is the fallback

It covers installs that predate the index and carries its bound with the answer, naming the roots walked, the depth, the folders it stopped at, and the roots it could not read.

Grouping by origin makes a target held in two clones count once, and a linked worktree carries a copy of its own target's stamp. Nothing removes a row, so a deleted project inflates the count until a read refuses its path. Measured at `427213fc` on 2026-08-30, against eight targets on this machine.

### The index has a second writer

`backfillTarget`, beside `recordTarget` in `src/targets/registry.ts`, is called by `canon targets list --sweep <root> --record` once per checkout a sweep finds. It dates each by that checkout's own `readStamp` rather than the backfill moment, for targets predating the index.

### Tests must not write the real index

`stateDir` checks `CANON_STATE_DIR` ahead of `XDG_STATE_HOME`, an override that keeps a test out of the home directory of whoever runs it.

A caller spawning `gov install` or `gov sync` as a real process inherits the real `HOME` unless it sets that override itself. That writes a row into this machine's real index for a fixture directory about to be deleted.

### The sandbox tree has the same exposure

`sandboxTree` in `src/commands/sandbox.ts` resolves the same three ways under `CANON_SANDBOX_DIR` and lands one folder below `stateDir`'s own result, so a caller redirecting one without the other still reaches the real machine through `canon sandbox`.

`canon/context/development/verification.md` covers the process tier's handling of both.

### A stamped folder can hold others

Nothing walking a filesystem for targets may stop at the first stamped folder. `private/career` on this machine carries its own stamp and contains eight further stamped repositories, so a walk that stopped at the first hides every one nested below it. Measured 2026-08-30.

A linked worktree under `.claude/worktrees/` carries a copy of its own target's stamp, which is why the walk skips `.claude` outright rather than reading five worktrees of one target as five targets.

### What the stamp covers

A missing or corrupt stamp degrades to the unattributed report rather than failing, the only path an unstamped target has.

### Tooling is stamped without being scanned

`src/tooling/` never calls `planSync`, so it records the stack chain it resolved instead of file hashes. `SCANNED_DOMAINS` in `src/sync/check.ts` is the narrower list the adapter, source-path, and install-marker lookups key on, and the closing unstamped line reads it too.

Three stamp domains stand against two scanned ones, since design joined both lists doing per-file work the way governance does.

### Opt-in domains

`OPT_IN_DOMAINS` is what the unstamped line reads on top of `SCANNED_DOMAINS`, and `uncoveredDomains` composes the two. A target absent governance has yet to install what every managed project carries, so naming it is the only place that shows up.

A target absent design chose that, and naming it would route every existing target to `canon design sync`, which warns `No design surface found` and exits 0.

### Governance is in both lists

`canon gov install` calls `writeChainStamp` beside `recordStamp`, so a governance record carries file hashes for what a sync would refresh and a chain for what the stack entitles it to.

`putDomain` merges the two independently. A write naming only `files` or only `chain` keeps the other half of that domain's previous record, which lets `writeStamp` and `writeChainStamp` each own one half across two calls that never run together.

### Adding or retiring a domain

Adding one means deciding which of the two lists it joins. Retiring one means editing both, and `STAMP_DOMAINS` is the edit that reaches a target's existing file.

### Unknown domain keys are ignored

`isStamp` validates only the domain records whose key names a current `StampDomain`. Rejecting the whole file would make `readStamp` return undefined, which `putDomain` reads as an unstamped target and rewrites from nothing, silently discarding every other domain's hashes on the next sync.

`sortDomains` drops the retired key at that write, retiring it with no migration. The `standards` and `snippets` keys a target holds from their closed install channels are the case this covers.

### The chain's shape follows its reader

Each domain stores the chain its reader needs.

- Tooling stores the full ordered chain, nearest first, since a `--skip` run installs fewer layers than the leaf's chain reproduces
  - The report therefore loads the recorded stacks directly rather than re-resolving
- Governance stores only the leaf `canon gov install` was given, since `resolveRules` walks that stack's own `extends` ancestors internally and a reader asking it again needs nothing more

### `chain` is optional

On `DomainStamp` it stays optional, so a stamp written before tooling joined the domains parses rather than reading as corrupt and discarding the three records it carries.

### A workspace root records no chain

One chain written there is a guess at what its packages hold, and the report saying unmeasured is the true answer. The detection reads `workspaces` in `package.json` and `pnpm-workspace.yaml`, and lives in `src/tooling/stamp.ts` so `src/sync/` never learns what a workspace is.

### Only a whole-stack install records

A flag-scoped `canon tooling inject --gitignore` installs one category, and a chain recorded from it would send the report scanning for configs and deps the caller never asked for.

The `claude` stack is excluded at that call site rather than in `prepare`, which keeps `canon claude` able to drive injection.

### Covers names what is stamped

Naming the domains a target has not stamped, rather than those the toolkit could stamp, tells an uncovered domain from a clean one.

`covers` is derived from the domains actually recorded, never from the constant list the engine can stamp. A compile-time constant claimed coverage of domains a target had never stamped.

### The anchor is per domain

Domains sync independently, so one shared revision lets one domain's sync advance the commit another measures its upstream range from, dropping that domain's changes out of the read.

Per-file attribution never sees it, because `attribute` compares hashes and never reads the anchor, which is why it fails quietly.

### The legacy stamp path

`readStamp` falls back to the retired `.claude/aitk.json` when `.claude/canon/config.json` is absent, read only. The path moved with no migration, so a target stamped before the move reads as unstamped without the fallback, zeroing every read keyed on the stamp.

`isLegacyStamped` answers whether the fallback fired, so `canon sync --check` can report the retired path rather than silently reading through it forever.

### Legacy flags reach the sweep

`src/targets/sweep.ts` and `src/targets/resolve.ts` call the same `isLegacyStamped` per checkout and carry it as `legacyPaths`, a subset of a group's `paths`. `canon sync --check` stays a per-target report with no group to collapse into a boolean.

### Stamp path order

`stampPaths` reads `canon/config/config.json` ahead of `.claude/canon/config.json`. `src/roots/surface.ts` carries a second root list rather than reusing `RECORD_ROOTS`, since a stamp is committed rather than gitignored and a shared list would put a session record folder under a root a tracked file also resolves against.

### One resolver for the fixed path

The fixed path resolves through `resolveExisting` in `src/roots/legacy.ts`, which `stamp.ts`, `src/audits/baseline.ts`, and `src/labels/map.ts` all call, so a later move edits one function rather than three copies of the same reasoning.

`sweep.ts`'s `isStamped` still lists its own paths, since it answers a different question, whether any spelling exists, rather than which one wins.
