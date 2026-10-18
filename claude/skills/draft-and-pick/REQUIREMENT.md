---
name: draft-and-pick
description: Why a pointer answers under the old `draft-and-pick` name, and the test that retires it
---

# Draft and pick requirement

## Gap

Without this skill, a person typing the old name after the rename to `pick-by-eye` meets an unknown command that names no successor. A target that has not run `canon migrate skill-names` still tells people to type it, and so does a live gitignored record, which the sweep never reads.

## Must

- Name `pick-by-eye` as the skill to run, so a typed invocation of the old name reaches the new one in one step
- Carry `disable-model-invocation: true`, so routing never matches the old description against a request `pick-by-eye` owns
- Retire once `canon migrate skill-names --json` reports zero citations in every target the rollout reaches and no live `.canon/` record names the old name

## Must not

- Carry any part of the draft and pick loop, which would give one behavior two bodies that drift apart
- Retire on a release number, which retires it on a date nothing measured

## Out of scope

- The work itself, which `pick-by-eye` owns
- Rewriting a stale citation, which `canon migrate skill-names` owns in a tracked file and the controlling session owns on the board
