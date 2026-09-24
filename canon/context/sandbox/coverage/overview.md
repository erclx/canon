---
title: Overview
description: The coverage report and what its two percentages measure, and the blast-radius rule deciding which skills earn an arm
---

# Overview

## Overview

`canon sandbox coverage` reports which scenarios declare expectations and which only provision a state. It reads the fixture tree rather than running anything, so it costs nothing and needs no provisioned sandbox. `--skills` adds a per-skill census beside the scenario view, and `--strict` exits 1 while any scenario declares nothing.

## Layout

- `src/sandbox/` owns the coverage report and the skill census
- `scripts/sandbox/fixtures/` owns each arm's `expect.toml`, which the report counts
- `scripts/sandbox/` owns the scenario scripts the report enumerates, and `exempt.toml` beside them

`canon/context/sandbox/coverage/arms.md` records what individual arms prove, and `canon/context/sandbox/coverage/census.md` covers the per-skill census, pairing, and exemptions.

## Decisions

### Two denominators

Scenarios and arms count separately, and the report prints both rather than picking the flattering one. Several arms can share one scenario, so dividing arms by scenarios always produces the higher figure, and the scenario percentage is the honest rollout number. Read the current pair off `canon sandbox coverage --json`, which carries `totalScenarios`, `armedScenarios`, and `armedArms`, rather than from a figure frozen into prose.

Both percentages floor rather than round, so a percentage a point under a hand-worked division is the measure working. `coveragePercent` states the reason.

A scenario enumerates from its script under `scripts/sandbox/<category>/`, not from the fixture tree. An unarmed scenario has no fixture directory to find, so counting fixtures would hide exactly the arms the report exists to surface. A declaration sitting at the command root belongs to the unnamed arm and reports as `(default)`.

### What a percentage does not weigh

Neither number weighs an arm by what it asserts. An arm can carry a single assertion over its own provisioning, such as `standards/skill.md` being absent, which is a claim about the fixture rather than about the skill under test. The count reads as scenarios reached rather than behavior covered, so a reader taking either percentage as skill coverage reads past what the declarations say.

The count measures declarations present, never declarations that work. `canon/context/sandbox/assertions.md` covers the ways a declaration counts as armed while asserting nothing.

## What earns a declaration

Arm a skill when a wrong run is silent and the damage lands in a target project rather than in the sandbox. Blast radius decides rather than a coverage percentage. A percentage names no particular skill and counts an arm asserting one provisioning fact the same as one asserting eleven things about a run, so it rewards whichever arm is cheapest to write next.

- The rule describes the arms already written as well as the next ones, since every skill armed before it was stated mutates a tree with no reader watching.
- A skill whose subject is a decision rather than an artifact still earns an arm when the damage is real, as with `canon-operator` routing a target to the wrong installer. `reply` is what lets such an arm assert the decision.
- A gov injection flag does not select an arm. `SANDBOX_INJECT_GOV` is a boolean naming no rule, so which scenario depends on which rule resolves by reading the skill bodies rather than by paying for an arm each.
- The rule selects `git-stage` and `git-split` ahead of everything else, and the harness cannot assert either, which is the git-state standing limit in `canon/context/sandbox/overview.md`. A rule selecting what nothing can check is working correctly, since it names the gap instead of hiding it behind a skill nobody nominated.

`scripts/sandbox/exempt.toml` holds the other half of the split: the rule says what to write, and an exemption says what never will be.
