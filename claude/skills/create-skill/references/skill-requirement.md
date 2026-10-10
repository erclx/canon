---
title: Skill requirement reference
description: Shape and content rules for the REQUIREMENT.md beside a skill
---

# Skill requirement reference

Applies to the `REQUIREMENT.md` beside each `SKILL.md`. It states what the skill is for, so a proposed change can be argued against something and the corpus can be read to decide whether a skill should exist at all.

## Scope

Governs `skills/<name>/REQUIREMENT.md`: why it exists, what it must answer, and its sections.

Does not govern:

- The skill folder, `SKILL.md`, and the rule that every skill carries a requirement: `skill.md`
- Voice, rhythm, and sentence construction: the `write-human` skill
- Punctuation, formatting, and word choice: `markdown.md`

## What a working requirement looks like

A requirement works when a proposed change to the skill can be settled by reading it alone, without re-deriving what the skill is for:

- Does this change close a gap the file states?
- Does a line already in the body trace to one of those gaps?
- Does this behavior belong to this skill or to a sibling the file names?

A requirement that leaves any of the three open is non-conforming regardless of whether it satisfies every shape rule below. The third question is what makes a requirement worth more than a restated description, because a boundary stated only in prose is never checked against the skill on the other side of it.

## Purpose

- Treat the file as the compressed statement of what the skill is for. A skill body is procedural by design, so its purpose sits spread across its steps, and a reader gets this file before opening the body whether or not the skill's scope is contested.
- Read it before editing the skill. When a change closes no gap the requirement states, change the requirement first or drop the change.
- Write the gaps from what the skill is for, then compare the body against them. A requirement derived from the body records the body's accidents as the requirement, and misinforms a reader who reads it in place of the body.

## Content

- State each gap as an observed failure, not an intent. "Without this skill a session invents its own filename" can be shown wrong. "This skill helps manage tasks" cannot fail, so it constrains nothing.
- Trace everything under `## Must` to a stated gap. A `Must` with no gap behind it is the padding the file exists to prevent.
- Keep it high level. A requirement that outgrows one file has stopped being a requirement, and `references/` already holds detail.
- Use `name` and `description` frontmatter, matching `SKILL.md` so the pair is consistent.

## Template

```markdown
---
name: <skill-name>
description: <one line, distinct from the SKILL.md description>
---

# <Skill name> requirement

## Gap

Without this skill, a session <observed failure>, <observed failure>.

## Must

- <behavior that closes a named gap>

## Must not

- <behavior that would be wrong even though it closes a gap>

## Guards

- <the refusal condition and its message>

## Out of scope

- <the adjacent thing this deliberately does not cover, and what covers it>
```
