---
name: internal-scripts
description: Scope boundary for the executable surface and what a sandbox run does and does not prove
---

# Internal scripts requirement

## Gap

Without this skill, a session adds a function `lib/` already owns, writes a sandbox scenario as a sibling file rather than an arm of the existing one, tests uncommitted edits through the global `canon` and reads main's behavior as the branch's, and calls a change verified from a run that cannot reproduce the trigger.

The last two cost most. Both return green, so neither says it measured the wrong thing, and the branch ships a verification receipt that covers nothing.

## Must

- A behavior `lib/` already holds is reused, and a duplicate the addition surfaces is consolidated
- A skill keeps one scenario file, extended with a new arm whose name is resolved before the run
- Uncommitted edits run through the worktree-local path rather than the global `canon`
- A run whose environment cannot reproduce the trigger states what it did not cover and queues the extension
- A refactor is verified by comparing the resulting state with the prior behavior, never by a green run alone

## Must not

- Mix an adversarial case into the happy-path arm
- Run a destructive operation unconfirmed against any remote but the pre-authorized playground

## Out of scope

- Reporting which changed skills and scripts lack a paired scenario edit at ship time, which `internal-sandbox-check` owns
