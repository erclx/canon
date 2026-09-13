---
title: Audits
description: Running every health check as one set, what the single verdict means, the exit code each outcome takes, the retained baseline and the delta it reports, and which corpora are kept out of the record
---

# Audits

`canon audits run` runs every audit this repository owns, reports each one under a single verdict, and compares each count to the floor the last recorded run left behind. Nothing here is a new measure. Every number it prints comes from a verb that already published it, which is what makes the command cheap and what separates it from writing another check.

```bash
canon audits run
canon audits run --json
canon audits run --record
canon audits run --corpus tracked --corpus per-machine
canon audits list --json
```

| Option            | Behavior                                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `--json`          | Add a machine-readable record on stdout, keeping the frame                                                 |
| `--root <path>`   | Measure this tree instead of the current worktree                                                          |
| `--record`        | Write this run's tracked counts to `canon/config/baseline.json`                                            |
| `--corpus <name>` | Limit the run to one corpus (`tracked`, `per-machine`, `upstream`), repeatable, defaulting to every corpus |

## What it runs

Nineteen verbs, listed by `canon audits list`. Each runs once in its fullest form, and the aggregate reads that verb's own record rather than imposing a shared envelope on it. Every one of those records already has consumers naming its keys, so a common shape would be a breaking change bought for tidiness.

The verbs walk separate trees and share no state, so they run together. Measured on the authoring machine at twelve verbs, a run finished in 0.8 seconds of wall clock against 4.4 seconds of processor, which is under every other stage in `bun run check`. `canon deps audit` is the one that changes that reading, since it reaches a network rather than a tree and its latency is the index's rather than this machine's: three clean runs measured 44.7, 77.6, and 62.9 seconds, and a stalled lookup runs to an explicit 120-second timeout rather than to bun's own 299-second ceiling. `--corpus` is what keeps a caller from paying that cost when it wants only the corpora on this disk.

Sixteen of the nineteen read a tree on this disk, the one added by `restated.md` and the one added by `census.md` among them, since the first reads four such trees against each other and the second counts every file in one. The two added by `state-scoped-risk.md` read committed state rather than an arriving change, which is the gap every review surface here leaves by construction, and the one added by `label-coverage.md` reads a branch range against a map the project declares.

Each is invoked as the CLI the caller is running rather than as a global `canon`. A globally installed binary resolves to the main checkout no matter which worktree is executing, so the aggregate would measure a tree the branch never touched and report a pass over it.

## What gates and what reports

Five findings fail the run: an unresolved context citation, a banned character, word, or spelling, a relative link resolving to nothing on disk, a skill folder carrying no `REQUIREMENT.md`, and a credential-shaped value in the tree the package ships. Each is a fact with no false-positive class behind it.

Four of the five are the ones `canon gate run` already fails a push on. The secret scan is the one entry gating without a stage behind it, added on that same fact-or-judgment test rather than as a side effect of registering a measure, and the architecture record already ranks content leaving the repository above content that stays.

Everything else reports. A heavy bullet, a long entry, a board row nothing resolves, a degradation term in a comment, and an implementation reaching history ahead of its test are judgments a reader settles. A push failing on one of those teaches contributors to route around the stage, which is the split recorded across every audit here and the one this command inherits rather than moves.

Growth against the baseline reports too. The standards behind the largest measures set no hard cap, so a count that rose is a fact about the corpus and a judgment about whether it matters.

## Exit codes

| Code | Meaning                                                              |
| ---- | -------------------------------------------------------------------- |
| `0`  | Every audit reported and none carried a finding that is a fact       |
| `1`  | Refused, with the reason on stderr                                   |
| `2`  | An audit carries a finding that is a fact                            |
| `3`  | An audit did not report, so the run measured less than the whole set |

`3` is a defect in the run rather than in the tree, which is why it takes a code of its own. An aggregate reporting a pass over a set it never finished measuring is the failure the command exists against, so an unparseable record, a verb that could not be started, and an exit no verb documents all land there instead of quietly counting as clean. The `markdown audit` empty-ban-set exit is the precedent: a corpus walked with nothing looked for is a broken check, not a clean tree.

The verdict is published as a field as well as an exit code. A reader branching on `summary.verdict` gets `clean`, `reported`, `findings`, or `incomplete` without inferring the difference between a quiet corpus and one nobody finished measuring.

### An absent corpus is not an unmeasured one

A per-machine folder that is not on this disk reports as `absent` and moves neither the verdict nor the exit code. Every one of those folders is gitignored, so a fresh clone and every CI run carry none of them, and counting six expected absences as failures pins the verdict at `incomplete` forever. A signal that never changes is one nobody reads after the second time they see it.

Which refusals count as an absence is declared per audit rather than inferred from the corpus alone. A per-machine corpus counts a missing folder. An upstream corpus counts every reason the advisory verb publishes, since each of the three means there is nothing resolved to measure. Several tracked audits override that default too, wherever the corpus not being there is the ordinary state of a target rather than a broken checkout: the secret scan for a project that publishes nothing, the skill corpora, the citation reach check, and the routing measure for a project holding no skills tree, and the context audit for a project that adopted none of the folders it measures.

Everything else stays `unmeasured`. That covers a tree git cannot list, which is a broken checkout, and a package declaring no `files` field, where a publish would pack the whole tree and the scan read none of it. Both are a corpus that exists and went unread, so softening either would report a pass over a shipped tree nobody measured.

Each override exists because the corpus answers the wrong question for that audit. The secret scan earns its from `private: true`, the one declaration that a package is never published, so a project carrying it reports an absent corpus rather than a broken one. Without that the aggregate would report `incomplete` in every such project on every run, which is the permanent signal this section opens by rejecting.

`upstream` is the third corpus value, carried by the advisory check alone. Its count moves when someone publishes rather than when someone edits here, so it is kept out of the retained baseline for the mirror image of the reason gitignored scratch is, and an offline run reports it absent rather than pinning the verdict at `incomplete` on every machine without a network.

Every run states how many corpora it measured against how many it skipped, including a run with no findings at all. A count of what passed reads as a verdict on the whole set unless the run also says what it never reached.

### What a shallow checkout changes

`canon gov test-order` scopes its range against the trunk and falls back to the root commit when no trunk ref resolves. A depth-1 checkout has neither, so the range is empty and the verb reports zero of everything rather than refusing. The numbers are real for the history present, which means a shallow run under-reports against a baseline taken from a full clone and shows as shrinkage. That is the safe direction, and it is the reason a `test-order` delta is worth reading only from a clone carrying the history.

## The retained baseline

`canon/config/baseline.json` holds the counts from the last run recorded with `--record`, alongside the day it was taken and the commit it was read at, falling back to `.claude/canon/baseline.json` for a project that has not moved. Each later run reports which counts moved and by how much.

The file is committed. A per-machine record cannot answer the question this half exists for, which is whether a number grew since anyone last looked, and a fresh checkout has to inherit that answer rather than start over. The cost is that a branch moving a count either fixes it or re-records it and says why, which is the shape the consumed-copy assertion already carries.

It sits under the project root rather than beside the aggregator in `src/`. The numbers describe one repository's corpus, and `src/` ships to every project that installs the CLI, so a baseline in the package would hand a target these counts to measure its own tree against.

### What is kept out of it

A gitignored record folder holds one machine's session scratch. Its counts describe somebody else's disk, so committing them writes a floor no other clone can reproduce and every contributor reads a regression against a number that was never about their tree. The board and five of the six record kinds are therefore reported on every run and recorded in none. `records-standards` is the exception, because that corpus is tracked.

An audit that did not report is left out rather than written as zero. Zero there records a clean corpus nobody measured, and the next run reads its real numbers as a regression against a floor that was never taken.

### The first run

A run with no baseline behind it says so rather than showing a delta of zero. Those two states say the same thing to a reader and mean opposite things, which is a defect this repository has already had to fix twice elsewhere. The same reasoning covers a check the baseline never recorded, a key the run produced that the record does not carry, and a key the record carries that this run did not produce. Each is named for what it is.

A hand-edited baseline that does not parse refuses the whole run. Reading a broken record as an absent one would reset the floor the file exists to hold, silently.

## In the verify pipeline

`bun run check` runs a reporting stage after the three gating stages, and never fails on it. Those three stages keep their own specific remedies, so the aggregate reports the rest and the growth, and a fact still fails the push at the stage that names what to do about it.

The stage runs `--corpus tracked --corpus per-machine` rather than the full set, so `deps` and its network latency sit outside the gate entirely. A weekly job reads the advisory index instead, on a schedule rather than on every push. `summary.audited` in the gate's own record therefore reads 19 against the 20 `canon audits run` reaches with no filter.

The stage reads `summary`, a flat object of scalars published beside the nested arrays. Every key in it is unique across the whole record, so a shell stage greps one out without a JSON parser. The three verbs the gating stages already ran walk their trees a second time here, which is the 0.8 seconds measured above and the reason the scoped set runs rather than only the part those stages skip: one verdict over the corpora describing this tree is the value, and a stage measuring a narrower subset would report a health nobody took.
