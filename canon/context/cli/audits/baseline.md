---
title: Baseline and census
description: The retained baseline in canon/config/baseline.json, why growth needs attributing before it reads as a regression, and the codebase census that feeds it
---

# Baseline and census

## Decisions

### The retained baseline

`canon/config/baseline.json` holds the counts from the last `--record` run, with the day and commit behind them. It is committed so a fresh checkout inherits the answer to whether a number grew since anyone last looked.

- A per-machine record makes every contributor's first run a first run, which answers nobody
- It sits under the project root, since `src/` ships to every project installing the CLI and a baseline there would hand a target this repository's counts
- `src/markdown/structure.ts` holds corpus figures as a `const`, and that shape cannot take a value a run writes back

### Only a tracked corpus is recorded

Five of the six record kinds and the board read gitignored session scratch, so their counts describe one machine's disk. They report on every run and are recorded in none, since a committed floor no other clone reproduces is worthless.

### A first run says it had nothing to compare against

A delta of zero and no prior record mean opposite things and read the same, a defect this repository has fixed twice. The same rule covers a key newly measured and a key the record holds that the run did not produce, each named for what it is.

### Growth needs attributing

A grown measure is not evidence the branch grew it. The record is anchored at a commit, so the gap spans every merge since the last `--record`, and a branch reading its own stage sees inherited drift as its own.

Count the corpus at `origin/main` and in the tree before treating a growth flag as a regression. On 2026-08-20 a run reported 4 grown against baseline `bd2be81a` while `HEAD` stood at `1725dd91`. Two of the 4 traced to 6 merged commits adding 163 lines across 8 context files. A measure whose corpus the branch never opened belongs to that gap.

### Never re-record to clear it

A feature branch running `--record` writes the trunk's accumulated growth into the floor under its own reason, and the next reader cannot separate the two. Leave the record alone and say in the pull request which measures grew and why.

### Attributing with `--root`

`--root` defaults to the current working directory, not the installation the CLI was linked from. That is the exception to the rule that a catalog command reads the install tree, and it makes attribution mechanical.

- Run the verb with `--json` at the main root and again at the branch worktree, then diff the per-measure counts
- The difference is the branch's own, and what remains against the recorded baseline belongs to the trunk
- The framed output states only the delta against the baseline, which mixes the two

### The codebase census

`canon census` is the nineteenth verb and answers what the tree is made of rather than what is wrong with it. It reads `listRepositoryFiles`, the corpus the citation check, the markdown corpus, and the secret scan share, and reports a file count, a breakdown by extension, and a line total.

It registers with an empty `gatingExits`, which lets `canon/config/baseline.json` retain its three headline counts. The growth series it answers ran 481 files on one date and 965 five weeks later, and without it someone counts by hand.

### Grouping is by extension

A config file and a source file land in separate buckets, and two source files sharing an extension land in one. The census answers what the tree holds, not what language it is written in, and a named-category mapping would add a second vocabulary the extension already states.

### The line total is text-only

A binary file and a listed file that will not open, such as a symlink leaving the tree, both count toward the file total and their extension's file count. Both are excluded from every line count.

The record's `skipped` field carries the two causes as one number. On a healthy tree they are indistinguishable, so a `skipped` count above what the tree's binary files explain signals a file in the corpus that will not open.

### What the baseline retains

`censusCounts` retains the three headline totals and leaves the extension breakdown to the `--json` record. Folding every extension into the baseline would grow the recorded key set with every language the tree picks up, which is a different failure than the one the baseline exists to catch.
