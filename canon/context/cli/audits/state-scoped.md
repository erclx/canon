---
title: State-scoped checks
description: The secret scan and the dependency advisory read, which measure what is already committed rather than what is arriving
---

# State-scoped checks

`canon secrets scan` and `canon deps audit` are the first two members whose subject is what is already committed rather than what is arriving. Every review surface a session can reach is scoped to a range, so a risk that predates that range is invisible to all of them by construction, and these two close that by scope rather than by subject. Neither re-reads a diff anywhere, which is what keeps them complementary to the review surfaces instead of competing with them.

### The corpus is the package's own files field

The secret scan reads what `package.json` publishes rather than a list of trees kept beside the check. That field is already the single statement of which trees leave this repository, so a second list would answer the same question and drift out of step with the publish. It also carries the negations the publish makes, which is what puts `scripts/sandbox`, `scripts/eval`, and every test file out of scope by the rule that keeps them out of the tarball rather than by an exclusion the check invented: a tree such as `src/capture` moves into or out of scope automatically as the publish negations themselves change. Hardcoding the shipped trees was the alternative, and it is the one that would need an exclusion list for the fixture trees from the start.

The plugin route lands in the same corpus without a second mechanism. `claude/` is a `files` entry, and its `standards` and `snippets` symlinks resolve into trees the field lists in their own right. The two symlinks themselves fail to open as text and are counted under skipped, which costs no coverage, since the check reads the real trees directly.

What the corpus leaves out is stated on every run rather than left for a reader to derive. Measured against this repository on 2026-08-21, the scan read 544 files and left 593 of the 1139 git lists unread, being everything under `.claude/`, `wiki/`, and `internal/`, the `.github/` workflows, and the trees the publish negations remove. This repository is public, so a clean run that named only its passing count would read as no credential anywhere in it. Widening to every tracked file stays a separate decision, since the row puts the shipped tree first deliberately.

### Keying on values is what empties the exclusion set

Every pattern matches an issued value and none matches a word. A scan keyed on `password`, `secret`, or `token` fires on the environment reads, the workflow inputs, and the prose naming those things, and this repository ships all three, so the keying rather than the exemption mechanism is what decides how much noise there is to exclude. Measured on 2026-08-21 across 544 files, the shipped tree produced zero findings with nothing exempted.

That measurement is what settled the exemption design. A path allow-list was declined because the noise it would target is word-keyed and not confined to the fixture trees, so it would have hidden part of the noise and none of the risk. The inline marker in `src/secrets/marker.ts` ships with an empty user set instead, shaped on the `stub: true` precedent: only a marker naming a reason counts, so a typo cannot mute a finding, and the exemption travels with the line rather than sitting in a list away from it. Add the first marker when the first false positive appears rather than in anticipation of one.

The rule set is in scope like any other file, so `src/secrets/scan.test.ts` asserts that no pattern matches the text of its own definition. A pattern that did would report this repository on every run and train a reader to mute the check.

### Upstream is a third corpus, not a variant of the other two

The advisory check shells the runtime's own command rather than carrying an index. A vendored database would be a second corpus to keep current, and what this check is worth is the report rather than the data. That buys one failure mode nothing else in the set carries, since the command reaches a network and an unreachable index has to be told apart from a tree with nothing against it. Exit codes cannot draw that line, because `bun audit` exits non-zero on advisories found and on a lookup that failed alike, so the record on stdout is what decides.

Which refusals read as an absence lives on the spec rather than being derived from the corpus alone. `absentReasons` overrides what the corpus would answer, and the secret scan is the reason it exists: its corpus is tracked, a tracked corpus admits no absence at all, and a project that publishes nothing refuses on every run. Those projects are where most targets installing this CLI sit, so deriving the set from the corpus alone would pin the aggregate at `incomplete` in all of them permanently.

An absent `files` field is not folded into that allowance, since npm packs the whole tree when the field is absent, which makes that project the one publishing the most rather than one publishing nothing. `private: true` is what separates them, being the only declaration that a project is never published, so `no-publish` joins the allowance and `no-files-field` reports `unmeasured` beside `no-git`. Both of those are a corpus that exists and went unread, which is the state the aggregate reserves that code for.

The population it turns on is measured rather than assumed. All four targets this CLI is installed into declare `private: true` and carry no `files` field, measured on 2026-08-21, so every one lands on `no-publish` and stays inside the allowance, which is what keeps the split from pinning the aggregate at `incomplete` where the design says it must not.

`Corpus` gained `upstream` for it rather than borrowing either existing value. The count moves when someone publishes rather than when someone edits here, so a retained baseline would report growth against a tree nobody touched, which is the risk the plan named and the reason it stays out of the record beside gitignored scratch. The same value answers the offline run: an index this machine could not reach reports `absent` and moves no verdict, where reading it as unmeasured would pin the aggregate at `incomplete` on every machine without a network.

Adding the member cost two consumers a branch each. `compareBaseline` reports an `upstream` delta kind rather than mislabelling it per-machine, and the report line says growth is not this tree rather than saying no baseline is kept for a machine. `AuditResult` carries `corpus` alongside `tracked` for that reason: the boolean says whether a count is retained and cannot say why, and the two callers needed the why.

### What was deliberately not built

A general state-scoped bug scanner. Change-scoped correctness review already exists and a state-scoped bug scan is a different product from the one asked for, so the boundary here is scope rather than subject and widening it to every source file buys tooling this repository does not own. The shipped seeds and golden configs are the part nothing else is positioned to check, which is why that corpus went first.
