---
title: Overview
description: The coverage report and what its two percentages measure, and the blast-radius rule deciding which skills earn an arm
---

# Overview

## Overview

`canon sandbox coverage` reports which scenarios declare expectations and which only provision a state. It reads the fixture tree rather than running anything, so it needs no sandbox.

```bash
canon sandbox coverage            # scenario view
canon sandbox coverage --skills   # adds the per-skill census
canon sandbox coverage --strict   # exits 1 while any scenario declares nothing
```

## Layout

- `src/sandbox/` owns the coverage report and the skill census
- `sandbox/fixtures/` owns each arm's `expect.toml`, which the report counts
- `sandbox/` owns the scenario scripts the report enumerates, and `exempt.toml` beside them
- `arms.md` and `workflow-arms.md` in this folder record what individual arms prove, and `census.md` covers the per-skill census, pairing, and exemptions

## Decisions

### Two denominators

The report prints a scenario percentage and an arm percentage, and the scenario one is the honest rollout number. Several arms share one scenario, so arms over scenarios always reads higher.

| Field            | Counts                          |
| ---------------- | ------------------------------- |
| `totalScenarios` | every scenario script           |
| `armedScenarios` | scenarios with at least one arm |
| `armedArms`      | arms carrying a declaration     |

Read the pair off `canon sandbox coverage --json` rather than from a figure frozen into prose. Both percentages floor rather than round, so one a point under a hand-worked division is the measure working, which `coveragePercent` states.

### Scenarios count from scripts

A scenario enumerates from its script under `sandbox/<category>/`, not from the fixture tree. An unarmed scenario has no fixture directory to find, so counting fixtures would hide exactly the arms the report exists to surface.

A declaration sitting at the command root belongs to the unnamed arm and reports as `(default)`.

### What a percentage does not weigh

Neither number weighs an arm by what it asserts. An arm can carry a single assertion over its own provisioning, such as `claude/skills/create-skill/references/skill.md` being absent, a claim about the fixture rather than the skill under test.

- Read the count as scenarios reached rather than behavior covered
- The count measures declarations present, never declarations that work, and `canon/context/sandbox/assertions.md` covers the ways a declaration counts as armed while asserting nothing

### What earns a declaration

Arm a skill when a wrong run is silent and the damage lands in a target project rather than in the sandbox. Blast radius decides rather than a coverage percentage, which names no skill and rewards whichever arm is cheapest to write next.

- The rule describes the arms already written as well as the next ones, since every skill armed before it was stated mutates a tree with no reader watching
- A gov injection flag does not select an arm, since `SANDBOX_INJECT_GOV` is a boolean naming no rule, so which scenario depends on which rule resolves by reading the skill bodies
- The rule selects `git-stage` and `git-split` first, which the harness cannot assert, per the git-state limit in `canon/context/sandbox/overview.md`. Naming that gap is the rule working.

`sandbox/exempt.toml` holds the other half of the split. The rule says what to write, and an exemption says what never will be.
