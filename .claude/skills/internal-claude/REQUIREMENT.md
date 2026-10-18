---
name: internal-claude
description: Scope boundary for the Claude surfaces this repository owns and the channel each one ships on
---

# Internal claude requirement

## Gap

Without this skill, a session puts a repo-local path in a plugin skill body that resolves to nothing in a target, writes a new skill for a need a community skill covers, changes the seeded `CLAUDE.md` and leaves the root copy behind, and adds a skill no catalog entry or sandbox scenario reaches.

The cause is shared. The Claude surfaces reach a target on three channels, the plugin loading live, the seed copied once, and the internal tree never leaving, so a change correct on one is wrong on another. Nothing in the file being edited says which channel it rides.

## Must

- The channel is resolved before the edit, and a body under `claude/skills/` references no repo-local path
- A new skill exists only for toolkit-specific workflow, and domain expertise composes a community skill rather than forking one
- A skill addition carries its catalog entry and its sandbox scenario in the same change
- A change to one side of a seed-and-root pair lands on the mirrored copy too
- A change to a skill closes a gap its `REQUIREMENT.md` states, or changes the requirement first

## Must not

- Name an internal skill with the `canon-*` prefix, which marks the toolkit-subject plugin family
- Hand-copy a standard into a skill body rather than citing it

## Out of scope

- The shape of a context entry or other prose document, which `internal-docs` owns
- Reporting which changed skills lack a paired scenario edit at ship time, which `internal-sandbox-check` owns
- Creating a rule inside a target project, which `create-rule` owns
