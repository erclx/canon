---
title: Baseline and census
description: The retained baseline in canon/config/baseline.json, what it records and why growth needs attributing before it reads as a regression, and the codebase census that feeds it
---

# Baseline and census

## The retained baseline

`canon/config/baseline.json` holds the counts from the last run recorded with `--record`, with the day and the commit behind them. It is committed, because the question the record answers is whether a number grew since anyone last looked and a fresh checkout has to inherit that answer. A per-machine record makes every contributor's first run a first run, which answers nobody.

A grown measure is not evidence the branch grew it. The floor is whatever the last `--record` wrote, so the gap it reports spans every merge since, and a branch reading its own stage sees an inherited drift as though it caused it. Count the corpus at `origin/main` and in the working tree before treating a growth flag as a regression to fix. Measured where the comment census read `degradationHits` at 7 against a recorded 14 while both trees carried the same 124 occurrences, so the floor was stale and the branch had added none.

It sits under the project root rather than beside the aggregator. `src/markdown/structure.ts` holds corpus figures as a `const` and is the nearest precedent, and that shape cannot take a value a run writes back. More to the point, `src/` ships to every project installing the CLI, so a baseline in the package hands a target this repository's counts to measure its own tree against.

Only a tracked corpus is recorded. Five of the six record kinds and the board read gitignored session scratch, so their counts describe one machine's disk and committing them writes a floor no other clone reproduces. They report on every run and are recorded in none, which is a split the plan did not anticipate and the corpus forces.

A first run reports that it had nothing to compare against rather than a delta of zero. Those two readings are indistinguishable and mean opposite things, which is the defect this repository has already fixed twice. The same rule covers a key newly measured and a key the record holds that the run did not produce, each named for what it is.

The record is anchored at a commit rather than at a branch point, so growth is measured against whatever the trunk held when someone last ran `--record`. A branch reading the report therefore sees its own movement mixed with every commit merged since, and the aggregate names neither. Attribute each grown measure to a file in the working diff before treating it as the branch's own. Measured on 2026-08-20, a run reported 4 grown against baseline `bd2be81a` while `HEAD` stood at `1725dd91`, and 2 of the 4 traced to the 6 commits merged in between, which added 163 lines across 8 context files including a new 79-line `destinations.md`. A measure whose corpus the branch never opened belongs to the gap between the two commits.

Re-recording is not the way to clear that. A feature branch running `--record` writes the trunk's accumulated growth into the floor under its own reason, and the next reader has no way to separate the two. Leave the record where it stands and say in the pull request which measures grew and why.

`--root` is what makes that attribution mechanical rather than a reading of the diff. It defaults to the current working directory rather than to the installation the CLI was linked from, which is the exception to the rule that a catalog command reads the install tree and is therefore untestable from a worktree. Run the verb twice with `--json`, once at the main root and once at the branch worktree, and diff the per-measure counts: the difference is the branch's own, and whatever remains against the recorded baseline belongs to the trunk. The framed output states only the delta against the baseline, which mixes the two, so the two-run diff is the read that separates them.

## The codebase census

`canon census` is the nineteenth verb, and the one that answers what the tree is made of rather than what is wrong with it. It reads `listRepositoryFiles`, the corpus the citation check, the markdown corpus, and the secret scan already share, and reports a file count, a breakdown by extension, and a line total. Registering it here with an empty `gatingExits` is what lets `canon/config/baseline.json` retain its three headline counts, since the growth series this measure exists to answer, at 481 files on one date and 965 five weeks later, otherwise depends on someone counting by hand.

Grouping is by extension rather than by a named language category. A config file and a source file land in separate buckets and two source files sharing an extension land in one, which answers what the tree holds rather than what language it is written in. A named-category mapping was declined for the same reason `contextCounts` declines a per-key severity table it does not need: a second vocabulary to maintain buys nothing the extension already states.

The line total is text-only. A file `isBinary` reads, and a file `listRepositoryFiles` lists that will not open, such as a symlink leaving the tree, are both counted toward the file total and their extension's file count, and both excluded from every line count. The record's `skipped` field carries the two causes as one number rather than leaving a reader to infer either from a subtraction. The two are indistinguishable on a healthy tree, which is what makes a `skipped` count above what the tree's binary files explain the signal that something in the corpus will not open, rather than a fact worth a second field.

`censusCounts` retains the three headline totals and leaves the extension breakdown out of the baseline. The breakdown is what a caller reads for its own sake off the `--json` record, and folding every extension into the retained baseline would grow the recorded key set with every language the tree ever picks up, which is a different failure than the one the baseline exists to catch.
