---
title: Measuring a timing
description: How to measure a speed claim so a reader can trust it, being one runner, alternating rounds, a generated fixture, a same-commit noise run, uncounted warm-up, capped steps, and every value reported beside its median
---

# Measuring a timing

Read this before a plan or a pull request claims one commit is faster than another. A timing taken once, beside other work, or against a single run of each side reads noise as a result.

## Contents

- [Where it runs](#where-it-runs)
- [The method](#the-method)
- [Reporting](#reporting)

## Where it runs

Measure on a machine nothing else uses. Parallel sessions share one machine's cores, so a number taken there carries their load and takes the cores their builds need.

- Run a measurement on a CI runner, or on hardware an operator holds, and never on the shared machine
- Name that place in the plan's Verification, per `${CLAUDE_SKILL_DIR}/../plan-feature/references/plan.md`
- Build the workflow that carries it from `${CLAUDE_SKILL_DIR}/../ci-workflow/references/comparison.md`, which owns its shape

## The method

Each rule below removes one way a comparison reads the machine instead of the code.

### The two sides

These rules keep the machine's state from favoring either side.

- Keep every round of both sides on one runner. A second runner, or a round per runner, adds a difference the change did not make.
- Alternate which side goes first, one round base then head and the next head then base. A side that always goes first meets a different machine, and interleaving spreads that evenly.
- Never run the two measured sides at once, since each takes the other's cores
- Lay a generated fixture, built by a script from a seed, in place of a copy of private data. Anyone can then repeat the run, and the repository holds no data it must not.

### The noise and the warm-up

These rules separate what the change did from what the run did.

- Run one commit against itself, with the same rounds. Its spread is the noise a change has to clear, so a gain inside that spread is not a result.
- Run a warm-up of both sides at once before the counted rounds, and leave it out of the counts, since the first run pays for cold caches. The tool hyperfine has `--warmup` for the uncounted run alone.
- Cap each measured step. Report a step past the cap as not reached, since dropping it makes the slow side look faster.
- Fix the round count before the run, at least 10 where the run is short, and never extend it until the result looks right

## Reporting

A single average hides the run that went wrong, so the summary carries more than one number per side.

- Report the median and the change in it, since one slow round moves a mean and leaves a median
- List every value by round beside the medians on the run's summary page, with the warm-up apart
- Count a value not reached as the largest, so a median never hides it
- Put the same-commit spread beside the change, so a reader sees what the change had to clear

The pull request's results table takes the medians and the conditions, per `${CLAUDE_SKILL_DIR}/../git-pr/references/pr.md`.
