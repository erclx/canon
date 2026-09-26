---
title: Reports
description: The comment census, the test-order report, the label coverage report, and the key-changes bijection
---

# Reports

## The comment census

- `canon comments scan` is the first command that parses the target's own source, a new capability class rather than another domain. Reading user code inherits problems no other command has: language detection, comment syntax per language, and literals that look like comments. The surface is held to two languages, line-oriented, no AST, so it stays a counting tool rather than becoming a parser.
- The counter is validated against a measurement taken by hand before it existed. `src/comments/trend.test.ts` replays the commits that measurement recorded and asserts the TypeScript series exactly. The replay skips rather than fails when the commits are unreachable, since CI checks out at depth 1.
- Absent and empty are distinct states for the degradation vocabulary. A sweep with no terms finds nothing, and reporting that as zero hits claims a codebase is clean when nothing was looked for. Rule discovery anchors on a `## Degradation vocabulary` heading rather than a filename, because governance rules are numbered and a renumber would empty the list while the sweep kept reporting clean.
- Case sensitivity for a vocabulary term is derived from the term rather than from a second list. A term carrying an uppercase letter is a marker convention (`TODO`, `HACK`) and matches exactly, while an all-lowercase term is prose (`used to`) and matches either casing. Matching `FIXED` case-insensitively would hit every comment containing the word "fixed".

### Recomputing rather than storing

A measurement that is a pure function of a tree is recomputed from git rather than stored. A ledger needs a schema, drifts from what it claims to measure, cannot answer a question nobody thought to store, and gives a target project nothing on the day it installs. Recompute works retroactively against history that already exists, which is what lets the trend arm replay commits from before the command existed.

The boundary is that this only holds for tree-pure metrics. Which author or session wrote a comment is not recoverable, and adding it would silently make the whole arm dishonest.

A hand-recorded figure can be unreproducible against the same replay, which is a finding about the figure rather than a test failure. The line totals replay exactly, so the file set is confirmed and only the comment method is lost, while a recorded comment figure can match no file set the command can construct: the figures nobody can repeat are the ones produced by hand.

## The test-order report

- `canon gov test-order` is the first check whose subject is git history rather than a tree. The verification run cannot reach the rule it answers by construction, since it executes a suite against one moment and the ordering exists nowhere but history.
- It sits under `gov` rather than as a top-level command, so it inherits a `list` surface instead of owing a new one. The rule it measures is a governance rule, which is what settles the domain.
- The blocking shape was considered and rejected. A pre-write hook refusing a source file with no test naming the behavior enforces the rule rather than reporting on it, and it fires on refactors, renames, and configuration. Do not reopen it.
- Nothing wires the verb into `bun run check` or a hook. Exit 2 on findings with no stage behind it is the `canon tasks validate` shape, taken for the reason the repository already records: gating a measure carrying a known false-positive class forces an escape hatch.
- Pairing is the whole difficulty and filename proximity is the weakest key available. A test sits beside its subject under one name across this corpus, so the assumption the check makes is the one the corpus already honors, and a behavior split across two modules is what it cannot reach.
- Three verdicts rather than two. A module the range modified rather than added goes to `unclassified` with its reason stated, because a refactor and a new behavior cannot be told apart from history, and counting it as a pass reports a healthy repository nobody measured.
- A subject whose paired test sits in neither the range nor the base goes there too, on the reason that a module nothing tests anywhere has no second side to order. A finding therefore needs both sides inside the range with the test arriving in a later commit, which is the one shape a fixture demonstrating the check has to seed. Seeding an implementation with no test at all reports `unclassified` and an empty `findings` array, so an arm built that way asserts nothing about the measure it was written for.
- The exit is 2 on a finding and 1 on a refusal. Neither gates, since the audit entry carries an empty gating-exit set, so a caller reads the record's `kind` and `findings` rather than the status.
- Coverage is stated on every run through `scope` and the read-past count. The rule speaks to every behavior and the verb speaks to `.ts` and `.tsx` pairs, so a summary omitting that is a stronger claim than the measure supports.
- Measured against the 40 commits behind `57ee7467`, the report found 7 satisfied pairs, 0 findings, 18 unclassified changes, and 125 paths read past. Zero findings is the expected first reading rather than a broken check, and the unclassified figure being the largest is the honest shape.

## The label coverage report

- `canon labels audit` resolves a changed set against `canon/config/pr-labels.toml` and names the paths no row reaches, which is the check the map's own comment already describes.
- Matching moved from a skill body into `src/labels/`, which is what makes it testable. The rule stated in `claude/skills/git-pr/references/labels.md` had nothing to exercise it, so the census behind the map's 41 prefixes was the only evidence it was right.
- Prefix-anchored matching is fixed rather than chosen. Rewriting it to a glob reaches every existing prefix and invalidates the measurement behind all of them.
- The verb answers two readers from one pass. `git-pr` wants the labels it is about to apply and the aggregate wants the uncovered count, and a shape serving only the first returns nothing the second can retain.
- A gap and a decision are separate outputs. `[declined]` moved out of the map's trailing comment into a table keyed by reason, because a report that could not tell an uncovered surface from a path somebody decided against is useful about neither.
- It reports rather than gates, registering with empty `gatingExits`. Whether an uncovered surface deserves a label is a judgment only whoever owns that surface can make.
- The aggregate retains `uncovered` alone. The declined count is whichever declined rows a branch touched rather than a measure of the map, so a clean trunk reads zero against eight declared, and retaining it also read a branch touching one declined path as carrying findings, since `classify` calls a run quiet only when every count is zero.
- `no-map` is the one refusal the catalog reads as an absence, which makes this the second tracked corpus taking that allowance beside the secret scan. A project declaring no map is labelled silently by design, and treating that as a break would make the map mandatory for every target.
- What it leaves unmeasured is a prefix reaching no path, so a row left behind by a deleted folder stays forever. That is the map going stale from the other side and a second measure.
- Replaying `3a0fd695..190af80b` reports 53 wholly declined commits, every one a release, matching what the map's comment records. The one exception carrying no label is the commit that edited the map at its former path, which the `repo` row does not reach now that the file has moved into `.claude/canon/`.

## The key-changes bijection

`canon pr key-changes` reads a pull request's file list off one `gh pr view` call, which caps at 100 rows and says nothing about having done so. A 101-file pull request views as 100, so a pull request at the cap takes a second read through the paginated endpoint and refuses as `gh-truncated` on a failure there rather than comparing against a set silently one file short.

The comparison itself credits two claim shapes the changed-file list alone can never satisfy: a bullet naming a rename's source path, and a bullet naming a pattern newly added to `.gitignore`. For a live pull request, `resolveApiEvidence()` in `src/commands/pr.ts` runs `compareKeyChanges()` once with neither, and only pays for `gh api repos/{owner}/{repo}/pulls/{number}/files` when that pass already reports an unmet claim, the same lazy trade the `gh-truncated` fallback above makes. That call is read as a plain array rather than shaped through `--jq`, since `--paginate` concatenates one filtered value per page rather than merging pages into a single array once a filter reshapes each row. The `--body`/`--base` path pays no such trade: `listRenames()` and `listIgnoreAdditions()` in `src/git-files.ts` read the same evidence off a local `git diff` unconditionally, since there is no network call to defer.

A read that fails and a read that succeeds and finds nothing produce the same empty `renames`/`ignoreAdditions`, which is a distinction `compareKeyChanges()` cannot recover on its own. `resolveApiEvidence()` returns `unread: true` on every failure past the probe, being the repository listing, the `gh api` call, and the JSON parse alike, and `readFromFile()` reads the same signal off `listRenames()` and `listIgnoreAdditions()` returning `undefined`. `BijectionInput.evidenceUnread` carries that flag into the comparison, where it downgrades a claim that would otherwise reach `unmet` into `unresolved` instead, on the same ground `listFilesByPage()` already refuses on: a set known to be short would let a correct bullet accuse a file nobody changed.
