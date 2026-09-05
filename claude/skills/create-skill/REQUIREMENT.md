---
name: create-skill
description: What skill creation is for, the gaps it closes, and why it confirms before writing
---

# Create skill requirement

## Gap

Without this skill, a new skill lands in the wrong shape and the wrong place. A session writes `SKILL.md` from its own idea of the format, writes malformed frontmatter that Claude Code routes on, and never opens the authoring standard that already answers every question it guessed at.

A skill born without its requirement is the second failure, and it surfaces much later. Coverage of the corpus is what the operator reads to decide whether a skill should exist, so every skill created without the sibling decays that reading, and the sweep that closes the gap has to reconstruct what the skill was for from the body it already shipped.

A third failure is a folder created for a moment a rule, a verb, or an existing skill already reaches, or for a procedure no session would get wrong from first principles. Nothing caught that before the folder existed, so the corpus grew by a skill an inward audit later had to argue for removing, with only a commit body recording the argument.

## Must

- Read the authoring standard and the prose standard before drafting, so the draft starts conformant rather than getting corrected into shape
- Answer, in writing, whether a rule, a verb, or an existing skill already reaches this moment, and whether the body carries a procedure a session would get wrong from first principles. A folder that fails either belongs to the surface that already covers it, not to a new skill.
- Draft the sibling `REQUIREMENT.md` beside the body, from what the skill is for rather than from the drafted body
- Confirm the name and both files with the user before writing. The name is the routing key and a folder that disagrees with its frontmatter fails silently.
- Write to the conventional skills path, so discovery finds it without configuration

## Must not

- Auto-trigger. Creation is a deliberate act and a skill invented from an ambiguous request is worse than none.
- Write either file before the user has seen it
- Derive the requirement from the drafted body, which records the draft's overfitting as the requirement
- Gate creation on whether anything will invoke the new skill beyond the author typing its name. That question has no answer yet.

## Guards

- The authoring standard is not installed: stop and name the command that installs it

## Out of scope

- Editing an existing skill, which the authoring standard and the skill's own requirement govern
- Whether anything ends up invoking the new skill: the usage census the toolkit's own context entry tracks, read once the skill has run
