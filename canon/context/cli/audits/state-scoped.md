---
title: State-scoped checks
description: The secret scan and the dependency advisory read, which measure what is already committed rather than what is arriving
---

# State-scoped checks

`canon secrets scan` and `canon deps audit` are the first two members whose subject is what is already committed rather than what is arriving. Every review surface a session reaches is scoped to a range, so a risk predating the range is invisible to all of them.

Neither re-reads a diff, which keeps them complementary to the review surfaces.

## Decisions

### The corpus is the package's `files` field

The secret scan reads what `package.json` publishes rather than a list of trees kept beside the check. That field already states which trees leave this repository, so a second list would drift out of step with the publish.

Hardcoding the shipped trees was rejected, since it would need an exclusion list for the fixture trees from the start.

### The field carries the negations

The field's negations put `scripts/eval` and every test file out of scope, and `sandbox/`, which no entry names, falls out by the rule keeping it out of the tarball. A tree such as `src/capture` moves into or out of scope as the negations change, with no exclusion the check invented.

### The plugin route needs no second mechanism

`claude/` is a `files` entry, and its `standards` symlink resolves into a tree the field lists in its own right. The symlink fails to open as text and counts under skipped, which costs no coverage since the check reads the real trees directly.

### What the corpus leaves out is stated each run

Measured on 2026-08-21, the scan read 544 files and left 593 of the 1139 git lists unread. Those are everything under `.claude/`, `wiki/`, and `internal/`, the `.github/` workflows, and the trees the publish negations remove.

This repository is public, so a clean run naming only its passing count would read as no credential anywhere. Widening to every tracked file stays a separate decision, since the shipped tree went first deliberately.

### Keying on values empties the exclusion set

Every pattern matches an issued value and none matches a word. A scan keyed on `password`, `secret`, or `token` fires on environment reads, workflow inputs, and prose naming them, and this repository ships all three.

Measured on 2026-08-21 across 544 files, the shipped tree produced zero findings with nothing exempted.

### The exemption design

A path allow-list was declined, since the noise it would target is word-keyed and not confined to fixture trees, so it would hide part of the noise and none of the risk.

The inline marker in `src/secrets/marker.ts` ships with an empty user set, shaped on the `stub: true` precedent.

- Only a marker naming a reason counts, so a typo cannot mute a finding
- The exemption travels with the line rather than sitting in a list away from it
- Add the first marker when the first false positive appears, not in anticipation

### The rule set is scanned too

`src/secrets/scan.test.ts` asserts that no pattern matches the text of its own definition. A pattern that did would report this repository on every run and train a reader to mute the check.

### Upstream is a third corpus

The advisory check shells the runtime's own command rather than carrying an index. A vendored database would be a second corpus to keep current, and the check is worth the report rather than the data.

That buys a failure mode nothing else carries, since the command reaches a network and an unreachable index must be told from a tree with nothing against it. `bun audit` exits non-zero on advisories found and on a failed lookup alike, so the record on stdout decides.

### Absent reasons live on the spec

`absentReasons` overrides what the corpus would answer. The secret scan is why it exists, since its corpus is tracked, a tracked corpus admits no absence, and a project that publishes nothing refuses on every run.

Those projects are where most targets sit, so deriving the set from the corpus alone would pin the aggregate at `incomplete` in all of them.

### A missing `files` field is not an allowance

npm packs the whole tree when the field is absent, so that project publishes the most. `private: true` is the only declaration that a project is never published, so `no-publish` joins the allowance.

`no-files-field` reports `unmeasured` beside `no-git`. Both are a corpus that exists and went unread, the state the aggregate reserves that code for.

### The population was measured

All four targets this CLI is installed into declare `private: true` and carry no `files` field, measured on 2026-08-21. Each lands on `no-publish`, which keeps the split from pinning the aggregate at `incomplete`.

### `Corpus` gained `upstream`

The count moves when someone publishes rather than when someone edits here, so a retained baseline would report growth against a tree nobody touched. That keeps it out of the record beside gitignored scratch.

The same value answers the offline run. An unreachable index reports `absent` and moves no verdict, since unmeasured would pin the aggregate at `incomplete` on every machine without a network.

### Two consumers gained a branch

Adding the member cost two consumers a branch each.

- `compareBaseline` reports an `upstream` delta kind, not a mislabelled per-machine one, and the report line says growth is not this tree
- `AuditResult` carries `corpus` beside `tracked`, since the boolean says whether a count is retained and cannot say why

### What was deliberately not built

A general state-scoped bug scanner. Change-scoped correctness review already exists, and a state-scoped bug scan is a different product from the one asked for.

The boundary is scope rather than subject. The shipped seeds and golden configs are what nothing else is positioned to check, so that corpus went first.
