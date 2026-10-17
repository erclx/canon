---
title: Sync
description: The sync engine and its adapters, ownership by location and by name, retired and renamed rules, and the canon sync git workflow
---

# Sync

`src/sync/` holds one engine that gov installs and syncs through, plus the git workflow `canon sync` runs afterward. Gov is the only adapter left.

The install stamp lets the engine tell a file the toolkit moved from a file the project edited, and `canon/context/cli/stamp.md` carries it. `canon/context/cli/sync-reporting.md` carries attribution from history and the freshness report, which reads the same plan a sync would apply.

- The git workflow spans `target.ts`, `git.ts`, and `workflow.ts`
- The stamp sits in `stamp.ts`, the drift report in `check.ts`, and the history fallback in `history.ts`

## Decisions

### What decides whether a domain installs

A domain installs as a file when something other than the model resolves it by path, and ships as a command when only a session's own judgment would open it. The harness glob-loads a rule, and a target's build tooling reads a config or `.claude/design/base.css` off its path, so each installs.

A skill reference is opened by the model on purpose, so it ships inside the plugin with no install and no sync.

### The criterion beat case by case

`canon/context/claude-plugin/skill-references/overview.md` carries why a reference has one home in its owner skill. Revisit when Claude Code loads a document on demand from a catalog of its own.

### The sync engine and its adapters

An adapter supplies only a source lookup and, optionally, surfaces the file walk cannot see. `src/gov/adapter.ts` needs no widening the engine does not already offer, which is evidence `SyncAdapter` generalizes rather than describing gov alone.

Treat a required engine change in a later adapter as a finding, and prefer widening the adapter interface over branching inside the engine.

### Three optional fields

The widened interface takes `nonInteractive`, `isExcluded`, and `onComplete` rather than a branch on the domain name. Each defaults to the behavior gov already had, so a widening could not silently change an existing adapter.

### `nonInteractive` has no declarer

`isExcluded` and `onComplete` default cleanly and cost nothing unused. The `refuse` branch in `src/sync/engine.ts` and the `hasUnattributedDrift` it guards are unreachable rather than merely unused.

Removing them is a decision to take deliberately, since the reasoning behind the extension point is recorded and would go with the code.

### The policy is a union

A headless run applies for a toolkit-owned domain and would refuse for one whose files a project edits. The refusing variant carries its own message and hint, so the engine never holds domain copy.

### `projectSubdir` orphans by location

It names a top-level folder the walk orphans, checked in `planSync` and `recordStamp` before `locateSource` runs, so a file there is orphaned even when its name matches a toolkit source.

Gov declared `project`, the name a target already reached for its authored rules, until its installed root narrowed to `.claude/rules/canon/` and left `project/` outside the walk.

### Design depends on it more heavily

Base plus target-owned override is the whole of its channel, and an override named exactly like the shipped `base.css` still has to survive a sync. The flat root keeps the name inference, so two mechanisms answer the ownership question.

### Location wins before a name lookup

A name-only `locateSource` reads a relocated toolkit file as project-authored, with no command able to tell the two apart. Five toolkit standards moved into a subfolder produced 17 such files across three targets.

The name inference stays as a floor under new files. Measured at `5da3214d` on 2026-08-25.

### An external project converged

A comparably shaped project reached the same mechanism without sharing code. It hashes what shipped, compares three ways against what the project holds and what it last recorded, and skips whatever the project edited.

Its version is 779 lines against `src/sync/`'s 5,787, and two projects reasoning independently to one answer is stronger evidence than either's own reasoning. Measured at `d5f519ee` on 2026-08-26.

### `installPattern` is the fourth field

It is the first one a domain needed for a reason other than its policy. The walk listed `**/*.md` unconditionally, and design ships a stylesheet.

It defaults to `DEFAULT_INSTALL_PATTERN`, so no existing adapter changed, and design sets `**/*.css`.

### The report shows which mechanism decided

For an adapter declaring `projectSubdir`, today design alone, `misplacedOrphan` gives the name-inferred orphan a notice naming the path under `projectSubdir` it would take. The location-orphaned file keeps the generic line.

The notice queues no change, since moving a file rewrites a path the project's own content may cite.

### The notice asks rather than tells

No source name matching is what a project-authored file looks like and equally what a renamed toolkit file looks like. The stamp cannot split them. `recordStamp` skips a file whose source is gone and `writeStamp` replaces the domain's whole `files` map, so a renamed file's entry survives exactly one sync past the rename.

Only the operator knows which they are looking at.

### Gov answers by location

Through `ownsInstalledRoot`, the toolkit owns a target's `.claude/rules/canon/` outright and a project keeps its own rules under `.claude/rules/project/`, which the walk never reaches.

A walked file with no source is a rule the toolkit retired or renamed. `planSync` classifies it `retired` and queues its delete, edited or not and whatever the stamp holds. Reporting it as orphaned would leave a retired rule loaded in every target that installed it.

### The location read was measured

A read of the six registered targets holding a `canon/` rules folder found no file there the toolkit does not ship, measured at `4f7cde48` on 2026-09-25.

### Two retirement alternatives lost

Both failed on a measured gap.

- Deleting only a file whose content still matched its stamped hash kept an edited rule alive forever and deleted nothing in a target installed before stamping
- The stamp drops a retired file's entry one sync after the retire regardless
- A shipped ledger of retired rule names would be kept by hand on every retire and say nothing about an unrecorded rename

### The newer-install guard

The stamp records the newest canon release that wrote each domain, and `planSync` holds every sourceless file as `orphaned`, naming both releases, when that release is newer than the running one. A binary older than the release that installed a rule cannot tell it from one the toolkit retired.

Without the guard a downgrade deletes every rule added in between. `putDomain` keeps the higher of the recorded and running releases, since an older binary lowering the mark would let its next run delete what the guard held on the first.

### Renames install only when declared

A rename or renumber installs the rule under its new name only when `governance/renames.toml` declares it. `renamed` is the fourth sourceless state and the only one that installs.

After the newer-install guard, `planSync` asks the optional `locateSuccessor` member, and a hit queues a copy of the successor's source and a delete of the old file. A miss keeps `retired`, where an undeclared rename lands.

### Successor copies dedupe

The copy is skipped when the target already holds the successor or an earlier entry in the same walk queued it, so two predecessors of one rule copy once.

### The ledger beat three inferences

Each inference fails on this tree.

- Matching on the slug after the number collides on three pairs of record-folder rules today
- Git rename detection at sync time needs toolkit history a registry install lacks
- Content similarity breaks on a regroup that rewrites bodies

### Why the ledger stays small

The rejected retirement ledger had to be kept on every retire, while this one covers only renames, the one fact no packaged file otherwise records. It is transitive and pruned only when its target rule is retired, so a target several releases behind still reaches the current name of every rule that ships.

`src/gov/renames.test.ts` fails on a key naming a live rule, a chain ending on no source, or a cycle.

### The gov adapter reads no chain for a rename

Holding the predecessor is the evidence of entitlement, which covers a rule layered on with `--add`. The successor lands in the source's rule folder unless the target already holds it in another.

The toolkit's source is installed rather than the old file's content, so a local edit is dropped the way `retired` drops one, and the notice says so. The missing-rules readers count a held rule's successor as held, so `--check` names a mid-rename file once, as `renamed`.

### What `--check` counts

`canon sync --check` skips every orphaned entry in `src/commands/sync.ts` and lists every `retired` and `renamed` one. `hasDrift` counts both, since a sync closes each mechanically.

A target's CI goes red on `--exit-code` the day a release retires a rule it holds, and one sync clears it.

### `project` is reserved at the source too

The name is reserved across the toolkit's own `governance/rules/` tree, not only a target's installed copy. `src/gov/adapter.test.ts` asserts its tree holds no `project/` category, which would fail first if a later toolkit category collided with it.

### The commit stages what changed

The sync commit stages the paths the syncs actually changed rather than `git add -A`. The workflow already reads those paths to classify each domain, so the commit matches its own message. `check_clean_tree` stays regardless, since it makes any staging choice survivable.

### canon sync

`canon sync [target]` runs every installed domain sync in sequence (governance, claude), then a git workflow step that detects which domains changed and previews the commit and pull request body before prompting.

Committing creates `chore/canon-sync-YYYYMMDD-HHMM` when the run is on `main` or `master` and stays on the current branch otherwise. The pull request body lists up to three changed filenames per domain, then a count for the rest.

### Prompting during sync

Claude sync runs under `CANON_NON_INTERACTIVE=1` so the embedded call does not prompt. Governance inherits stdin and prompts for its own changes, and the combined pull request preview is the confirmation gate for the workflow alone.

`canon claude sync` writes only `.gitignore`, so the changed-file tracking watches that path and a gitignore-only change still reports under a `claude/` domain line. Seed audits stay a manual hand merge against the toolkit copy, which `canon sync` reminds the reader of when `.claude/` is present.

### Governance detects and syncs differently

It reports as absent without `.claude/rules/`, yet still syncs when only the retired `.claude/GOV.md` remains, so the sync can delete it.

### When the workflow skips

The workflow is skipped when the target is not a git root, and the pull request path is hidden when `gh` is missing while committing still works. It stops with a warning when the timestamped branch already exists locally or on the remote, and two runs inside one minute collide by design.
