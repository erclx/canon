---
name: draft-screencast
description: Why a pointer answers under the old `draft-screencast` name, and the test that retires it
---

# Draft screencast requirement

## Gap

Without this skill, a person typing the old name after the rename to `script-screencast` meets an unknown command that names no successor. A target that has not run `canon migrate skill-names` still tells people to type it, and so does a live gitignored record, which the sweep never reads.

## Must

- Name `script-screencast` as the skill to run, so a typed invocation of the old name reaches the new one in one step
- Carry `disable-model-invocation: true`, so routing never matches the old description against a request `script-screencast` owns
- Retire once `canon migrate skill-names --json` reports zero citations in every target the rollout reaches and no live `.canon/` record names the old name

## Must not

- Carry any part of the screencast script draft, which would give one behavior two bodies that drift apart
- Retire on a release number, which retires it on a date nothing measured

## Out of scope

- The work itself, which `script-screencast` owns
- Rewriting a stale citation, which `canon migrate skill-names` owns in a tracked file and the controlling session owns on the board
