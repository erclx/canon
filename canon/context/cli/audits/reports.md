---
title: Reports
description: The comment census, the test-order report, the label coverage report, and the key-changes bijection
---

# Reports

## Decisions

### The comment census

`canon comments scan` is the first command that parses the target's own source, a new capability class rather than another domain. Reading user code brings language detection, comment syntax per language, and literals that look like comments.

The surface is held to two languages, line-oriented, no AST, so it stays a counting tool rather than becoming a parser.

### The counter is validated by a hand measurement

`src/comments/trend.test.ts` replays the commits a hand measurement recorded and asserts the TypeScript series exactly. The replay skips rather than fails when the commits are unreachable, since CI checks out at depth 1.

### Absent and empty are distinct

A sweep with no terms finds nothing, and reporting that as zero hits claims a clean codebase when nothing was looked for. Rule discovery anchors on a `## Degradation vocabulary` heading rather than a filename, since governance rules are numbered and a renumber would empty the list while the sweep kept reporting clean.

### Case sensitivity comes from the term

A term carrying an uppercase letter is a marker convention (`TODO`, `HACK`) and matches exactly. An all-lowercase term is prose (`used to`) and matches either casing. Matching `FIXED` case-insensitively would hit every comment containing the word "fixed".

### Recompute rather than store

A measurement that is a pure function of a tree is recomputed from git. A ledger needs a schema, drifts from what it measures, cannot answer a question nobody stored, and gives a target nothing on install day.

Recompute works against history that already exists, which lets the trend arm replay commits from before the command existed.

### The boundary of recomputing

It holds only for tree-pure metrics. Which author or session wrote a comment is not recoverable, and adding it would silently make the whole arm dishonest.

A hand-recorded figure can be unreproducible against the same replay, which is a finding about the figure rather than a test failure. The line totals replay exactly, so the file set is confirmed and only the comment method is lost.

### The test-order report

`canon gov test-order` is the first check whose subject is git history rather than a tree. A verification run cannot reach the rule by construction, since it executes a suite against one moment and the ordering exists only in history.

It sits under `gov`, so it inherits a `list` surface rather than owing a new one, and the rule it measures is a governance rule.

### A blocking hook was rejected

A pre-write hook refusing a source file with no test naming the behavior enforces the rule rather than reporting on it, and it fires on refactors, renames, and configuration. Do not reopen it.

### Nothing wires it into the gate

Exit 2 on findings with no stage behind it is the `canon tasks validate` shape. Gating a measure with a known false-positive class forces an escape hatch.

### Pairing is by filename

Filename proximity is the weakest key available, and it matches the corpus, where a test sits beside its subject under one name. A behavior split across two modules is what it cannot reach.

### Three verdicts

A module the range modified rather than added goes to `unclassified` with its reason, since a refactor and a new behavior cannot be told apart from history. Counting it as a pass reports a healthy repository nobody measured.

A subject whose paired test sits in neither the range nor the base goes there too, since a module nothing tests anywhere has no second side to order.

### A fixture needs a late test

A finding needs both sides inside the range with the test arriving in a later commit. Seeding an implementation with no test reports `unclassified` and an empty `findings` array, so an arm built that way asserts nothing about the measure.

### Exit and coverage

The exit is 2 on a finding and 1 on a refusal, and neither gates, since the audit entry carries an empty gating-exit set. A caller reads the record's `kind` and `findings`.

Coverage is stated on every run through `scope` and the read-past count. The rule speaks to every behavior and the verb to `.ts` and `.tsx` pairs, so a summary omitting that overclaims.

### The first reading

Measured against the 40 commits behind `57ee7467`, the report found 7 satisfied pairs, 0 findings, 18 unclassified changes, and 125 paths read past. Zero findings is the expected first reading, and unclassified being the largest figure is the honest shape.

### The label coverage report

`canon labels audit` resolves a changed set against `canon/config/pr-labels.toml` and names the paths no row reaches, the check the map's own comment describes.

Matching moved from a skill body into `src/labels/`, which makes it testable. The rule in `claude/skills/git-pr/references/labels.md` had nothing exercising it, so the census behind the map's 41 prefixes was the only evidence it was right.

### Matching is prefix-anchored

The anchoring is fixed rather than chosen. A glob rewrite reaches every existing prefix and invalidates the measurement behind all of them.

### One pass serves two readers

`git-pr` wants the labels it is about to apply and the aggregate wants the uncovered count. A shape serving only the first returns nothing the second can retain.

### A gap and a decision differ

`[declined]` moved out of the map's trailing comment into a table keyed by reason. A report that cannot tell an uncovered surface from a path somebody decided against is useful about neither.

### It reports rather than gates

It registers with empty `gatingExits`. Whether an uncovered surface deserves a label is a judgment only whoever owns that surface can make.

### The aggregate retains `uncovered` alone

The declined count is whichever declined rows a branch touched, not a measure of the map, so a clean trunk reads zero against eight declared. Retaining it also read a branch touching one declined path as carrying findings, since `classify` calls a run quiet only when every count is zero.

### `no-map` is an absence

It is the one refusal the catalog reads as an absence, making this the second tracked corpus with that allowance beside the secret scan. A project declaring no map is labelled silently by design, and treating that as a break would make the map mandatory for every target.

### Stale rows are unmeasured

A prefix reaching no path, such as a row left behind by a deleted folder, stays forever. That is the map going stale from the other side and a second measure.

### Replay check

Replaying `3a0fd695..190af80b` reports 53 wholly declined commits, every one a release, matching the map's comment. The one unlabeled exception edited the map at its former path, which the `repo` row does not reach now that the file lives in `.claude/canon/`.

### The key-changes bijection

`canon pr key-changes` reads a pull request's body off the REST pull endpoint and its file list off the paginated files endpoint. `gh pr view` runs on GraphQL, which a cloud session's proxy refuses, and it capped the file list at 100 rows silently.

A failed page refuses as `gh-failed` rather than comparing against a set one file short.

### Two claim shapes need more than the file list

The comparison credits a bullet naming a rename's source path and a bullet naming a pattern newly added to `.gitignore`. The changed-file list alone can never satisfy either.

For a live pull request, `resolveApiEvidence()` in `src/commands/pr.ts` runs `compareKeyChanges()` once with neither. It pays for the full rows of `gh api repos/{owner}/{repo}/pulls/{number}/files` only when that pass reports an unmet claim.

### Read the files call as a plain array

`--paginate` concatenates one filtered value per page once a `--jq` filter reshapes each row, rather than merging pages into one array.

The `--body`/`--base` path pays no such trade. `listRenames()` and `listIgnoreAdditions()` in `src/git/files.ts` read the same evidence off a local `git diff`, since no network call exists to defer.

### Unread evidence downgrades a claim

A failed read and a read finding nothing produce the same empty `renames` and `ignoreAdditions`, which `compareKeyChanges()` cannot tell apart. `resolveApiEvidence()` returns `unread: true` on every failure past the probe, being the repository listing, the `gh api` call, and the JSON parse.

- `readFromFile()` reads the same signal off `listRenames()` and `listIgnoreAdditions()` returning `undefined`
- `BijectionInput.evidenceUnread` carries it into the comparison, where a claim that would reach `unmet` becomes `unresolved`
- That is the ground `listFilesByPage()` already refuses on, since a set known to be short would let a correct bullet accuse a file nobody changed
