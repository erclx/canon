---
name: internal-scripts
description: Scope boundary for the executable surface and what a sandbox run does and does not prove
---

# Internal scripts requirement

## Gap

Without this skill, a session adds a function `lib/` already owns, writes a sandbox scenario as a sibling file rather than an arm of the one that exists, tests uncommitted edits through the globally installed `canon` and reads main's behavior as the branch's, and calls a change verified from a run whose environment cannot reproduce the trigger.

The last two are the expensive ones. Both return green, so neither reports that it measured the wrong thing, and the branch ships with a verification receipt that covers nothing.

## Must

- Check `lib/` for the behavior before adding it, and consolidate the duplicate when adding surfaces one
- Extend the scenario a skill already has with a new arm, keeping one scenario file per skill
- Invoke a script through its worktree-local path while the edits are uncommitted, since the global `canon` resolves to the main checkout
- State what a run did not cover when the scenario's environment cannot reproduce the trigger, and queue the extension rather than treating green as proof

## Must not

- Read a green run as proof of a refactor on its own. Compare the resulting state against the prior behavior and report the comparison.
- Mix an adversarial case into the happy-path arm, which leaves a failure unreadable as a property of the skill rather than of the fixture

## Guards

- A multi-arm scenario needs its arm resolved before the run. An unresolved arm reaches the picker, which aborts without a terminal and takes the first arm when forced past.
- Destructive operations run unconfirmed against the pre-authorized playground repository alone. Every other remote stays production and needs explicit approval.

## Out of scope

- Auditing which changed skills and scripts lack a paired scenario edit at ship time: `internal-sandbox-check`. This skill authors and runs a scenario, that one reports whether the pairing held.
- The stream and output contract each CLI command owes, which `docs/agents/output-shape.md` specifies
