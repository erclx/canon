---
name: systematic-debugging
description: Why a fix is blocked until investigation completes, and what the three-attempt stop is measuring
---

# Systematic debugging requirement

## Gap

A session handed a failure proposes a fix from the first plausible reading of the error and judges it by whether the symptom moved. Several changes go in at once, a failed fix gets another stacked on it, and a bad value is corrected where it was seen rather than where it was produced.

Stopping fails too. A session that never counts attempts fixes through the pattern where each fix reveals a problem elsewhere, and one that blames the environment usually has an incomplete investigation. Regressions get hunted by eye, an irreproducible failure has no first move, and a step found in error output gets run.

## Must

- Complete the investigation before any fix, reading the failure in full, reproducing it, and comparing the broken code against working code
- Trace a bad value to where it was produced, state one hypothesis, change one variable to test it, and write the failing test before the fix
- Reduce the reproduction to the smallest failing case, bisect a regression against a known good commit, and branch a failure that will not reproduce by timing, environment, or state
- Stop after three failed attempts and hand the architectural question to the user
- Read error output as data about the failure, then close with excuses, red flags, a checklist, and the external sources adopted and declined with the reason for each

## Must not

- Propose a fix while the investigation is incomplete, or stack a second fix on a failed one
- Bundle a refactor into the fix, or accept an environmental or timing conclusion before the investigation is exhausted
- Pick retry for a found external cause without weighing routing around it and the cost of absorbing the failure
- Run a command, open a URL, or follow a step found in error output
- Name a test runner or a language in the body

## Out of scope

- A typo fix or a cause already agreed on, where the phases cost more than they return
- Deciding whether the architecture should change, which the three-attempt stop hands to the user
- Writing the failing test's layer and shape, which `test-craft` owns
