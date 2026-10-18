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

- Treat the file as the compressed statement of what the skill is for. A body is procedural by design, so its purpose sits spread across its steps.
- A reader gets this file before opening the body, whether or not the skill's scope is contested
- Read it before editing the skill. When a change closes no gap the requirement states, change the requirement first or drop the change.
- Write the gaps from what the skill is for, then compare the body against them
- A requirement derived from the body records the body's accidents as the requirement, and misinforms a reader who reads it in place of the body

## Sections

The file carries these H2s in this order and no others. `canon claude skills audit` reports a missing Gap or Must and a Guards heading.

| Section        | When                                      | Holds                                                         |
| -------------- | ----------------------------------------- | ------------------------------------------------------------- |
| `Gap`          | Always                                    | The failures a session hits today without the skill, as prose |
| `Must`         | Always                                    | The outcomes that close those failures, one per bullet        |
| `Must not`     | When a behavior closes a gap and is wrong | That behavior, one per bullet                                 |
| `Out of scope` | When a sibling owns an adjacent behavior  | The behavior and the skill that owns it                       |

`Guards` is retired. A refusal condition is a `Must not` bullet, and the message it prints belongs to the body.

## Caps

The audit reports each cap it finds breached, and a rewrite batch turns the report into a gate for the files it brings under.

- Each list holds at most 5 bullets. A sixth `Must` is a sign the skill does two jobs or the list restates its steps.
- The file holds at most 400 words of body, frontmatter excluded
- Gap carries no `YYYY-MM-DD` date and no `#NNN` issue or pull request number outside a code span

## Content

- State each gap as a failure a session hits today, in the present tense. "Without this skill a session invents its own filename" can be shown wrong.
- Never state a gap as an intent. "This skill helps manage tasks" cannot fail, so it constrains nothing.
- Keep history out of Gap. The incident, its date, and the pull request that earned a rule stay in git, where `git log` on the file finds them.
- Write each `Must` as an outcome a reader can check against the body, never as a step the body takes. "The committed set is exactly the staged set" is an outcome.
- Trace every `Must` to a stated gap. A `Must` with no gap behind it is the padding the file exists to prevent.

The frontmatter carries `name` and `description`, matching `SKILL.md` so the pair is consistent.

## Template

```markdown
---
name: <skill-name>
description: <one line, distinct from the SKILL.md description>
---

# <Skill name> requirement

## Gap

Without this skill, a session <failure it hits today>. <A second failure, when there is one>.

## Must

- <outcome that closes a named failure>

## Must not

- <behavior that would be wrong even though it closes a gap>

## Out of scope

- <adjacent behavior>, which `<sibling-skill>` owns
```

### Worked example

`git-commit`'s requirement in this shape, at 167 words as the audit counts them.

```markdown
---
name: git-commit
description: What commit generation is for, the gaps it closes, and where the family boundary sits
---

# Git commit requirement

## Gap

Without this skill, a commit message takes whatever shape the session picks. The type and scope drift from the history's convention, the subject runs past the log's width, and a lockfile diff crowds out the change the message should describe.

A plain request to commit also reaches the grouping sibling, which restages whole files, so a hunk-level selection ships wider than the user reviewed.

## Must

- The message follows the commit format and versioning references
- The message describes the staged diff with lockfiles excluded
- The user sees the message and its length before the commit runs
- The committed set is exactly the staged set
- The description claims single-concern and hunk-level staged sets, and names `git-stage` for a mixed one

## Must not

- Stage or unstage anything
- Commit when nothing is staged
- Emit anything after the result line

## Out of scope

- Splitting a mixed diff into several commits, which `git-stage` owns
- Naming a branch, which `git-branch` owns
- Pushing or opening a pull request, which `git-pr` owns
```
