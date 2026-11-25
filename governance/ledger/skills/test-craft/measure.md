---
title: Measuring a timing reference ledger
description: Sources for claude/skills/test-craft/references/measure.md, one row per bullet
---

# Measuring a timing reference ledger

The field is benchmarking practice. The hyperfine README carries the warm-up and the outlier warning, and the Go `benchstat` documentation carries idle machines, interleaved runs, medians, and the repeat count. A rule neither states is a house choice naming the misreading it prevents.

## Where it runs

| Bullet                                  | Source                                                                                                                                                         | Read       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Never on the shared machine             | [benchstat](https://pkg.go.dev/golang.org/x/perf/cmd/benchstat): "To reduce noise, make sure you run benchmarks on an otherwise idle machine."                 | 2026-11-25 |
| Name the place in Verification          | House choice: a plan that names no place leaves the worker to measure wherever it stands, which in a parallel run is the machine every other session builds on | 2026-11-25 |
| The workflow shape stays in ci-workflow | House choice: a recipe restating the workflow's triggers and worktrees here would drift from `ci-workflow`'s comparison reference, which owns them             | 2026-11-25 |

## The method

| Bullet                          | Source                                                                                                                                                                                                                            | Read       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| One runner for both sides       | House choice: two runners add a hardware difference the change did not make, and a gain read across them is a gain in the machine                                                                                                 | 2026-11-25 |
| Alternate which side goes first | [benchstat](https://pkg.go.dev/golang.org/x/perf/cmd/benchstat): "It's also important that noise is evenly distributed across benchmark runs." and "The best way to do this is to interleave before and after runs."              | 2026-11-25 |
| Never run both at once          | House choice: two measured sides running together take each other's cores, so each number is the pair's load rather than its own                                                                                                  | 2026-11-25 |
| A generated fixture             | House choice: a copy of private data puts that data in a repository and leaves the run unrepeatable by anyone without it, while a seeded generator rebuilds the same input anywhere                                               | 2026-11-25 |
| One commit against itself       | [hyperfine](https://github.com/sharkdp/hyperfine): "Statistical outlier detection to detect interference from other programs and caching effects", which a same-commit run measures directly as the spread a change has to clear  | 2026-11-25 |
| An uncounted warm-up            | [hyperfine](https://github.com/sharkdp/hyperfine): "you can use the `-w`/`--warmup` option to perform a certain number of program executions before the actual benchmark"                                                         | 2026-11-25 |
| Cap a step, report it unreached | House choice: dropping a step that passes the cap removes the slowest value, so the slow side reads faster than it ran                                                                                                            | 2026-11-25 |
| Fix the round count first       | [benchstat](https://pkg.go.dev/golang.org/x/perf/cmd/benchstat): "Pick a number of benchmark runs (at least 10, ideally 20) and stick to it." and "avoid simply rerunning your benchmarks until it reports a significant change." | 2026-11-25 |

## Reporting

| Bullet                                  | Source                                                                                                                                                                       | Read       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Report the median and its change        | [benchstat](https://pkg.go.dev/golang.org/x/perf/cmd/benchstat): "For each benchmark, benchstat computes the median and the confidence interval for the median."             | 2026-11-25 |
| Every value by round                    | House choice: a median alone hides a round that went wrong, and a reader cannot tell a stable run from one with a single wild value                                          | 2026-11-25 |
| Count an unreached value as the largest | House choice: a value dropped from the list lets the median ignore it, while the largest value keeps the slow case in the middle of the sort                                 | 2026-11-25 |
| The spread beside the change            | [benchstat](https://pkg.go.dev/golang.org/x/perf/cmd/benchstat): "Note that \"statistically significant\" is not the same as \"large\"", so a change reads against its noise | 2026-11-25 |
