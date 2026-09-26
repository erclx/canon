---
name: internal-claude
description: Scope boundary for the Claude surfaces this repository owns and the channel each one ships on
---

# Internal claude requirement

## Gap

Without this skill, a session edits a plugin skill body with a repo-local path that resolves to nothing in a target project, writes a new skill for a need a community skill already covers, changes the seeded `CLAUDE.md` and leaves the root copy behind, and adds a skill that no catalog entry and no sandbox scenario reaches.

The failures share one cause. The Claude surfaces reach a target through three channels, the plugin loading live, the seed copied once, and the internal tree never leaving, so a change correct on one channel is wrong on another. Nothing about the file being edited announces which channel it is on.

## Must

- Resolve the channel before the edit, since a shipped body, a seeded copy, and an internal body carry different constraints on what they may reference
- Establish that the need is toolkit-specific workflow before a new skill exists, and compose a community skill rather than writing or forking one when the need is domain expertise
- Carry a skill addition through its catalog entry and its sandbox scenario in the same change, so a shipped skill is both discoverable and exercised
- Update the mirrored copy when a change lands on one side of a seed-and-root pair

## Must not

- Reference a repo-local path from a body under `claude/skills/`, which resolves to nothing where that body runs
- Use the `canon-*` prefix on an internal skill. That prefix marks the toolkit-subject plugin family, and `internal-*` marks the internal tree.
- Hand-copy a standard into a skill body. Cite it, so one owner keeps every copy current.

## Guards

- Read a skill's sibling `REQUIREMENT.md` before changing it. When the change closes no gap that file states, change the requirement first or drop the change.
- When a plan names a `canon-*` folder under `.claude/skills/`, flag the mismatch before the folder exists rather than after the catalog carries it.

## Out of scope

- The shape a context entry or any other prose document takes, which `internal-standards` owns through `standards/context.md`. This skill writes the content of the two Claude entries when a plugin or internal change dates them.
- Reporting which changed skills lack a paired scenario edit at ship time: `internal-sandbox-check`
- Creating a rule or a standard inside a target project, which the shipped `create-rule` and `create-standard` skills do
