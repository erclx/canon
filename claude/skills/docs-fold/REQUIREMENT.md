---
name: docs-fold
description: Why a pointer answers under the fold skill's old name, and the test that retires it
---

# Docs fold requirement

## Gap

Without this skill, a person typing the old name after the rename to `context-fold` meets an unknown command with nothing naming where the skill went. A target that has not run `canon migrate skill-names` still holds files telling someone to type it, and a live gitignored record written before the rename still names it, since the sweep reads the tracked listing only.

## Must

- Name `context-fold` as the skill to run, so a typed invocation of the old name reaches the new one in one step
- Carry `disable-model-invocation: true`, so routing never matches the old description against a request the new skill owns

## Must not

- Carry any part of the fold procedure, which would give one behavior two bodies that drift apart
- Retire on a release number. Retire it when `canon migrate skill-names --json` reports zero citations in every target the rollout reaches and no live `.canon/` record names the old name, since a release number retires it on a date nothing measured.

## Out of scope

- The fold itself, which `context-fold` owns
- Rewriting a stale citation, which `canon migrate skill-names` owns in a tracked file and the controlling session owns on the board
