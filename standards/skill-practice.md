---
title: Practice skill reference
description: Closing sections and source ledger for a skill carrying engineering practice
---

# Practice skill reference

Applies to a practice skill, one carrying engineering judgment a session applies while it works, where the failure is skipping the practice or cutting it short rather than not knowing it. Its body takes the reference shape, and this file fixes how it closes and what it cites.

## Scope

Governs the closing sections of a practice skill's `skills/<name>/SKILL.md` and the source ledger at `skills/<name>/references/adopted.md` beside it.

Does not govern:

- The skill folder, its frontmatter, the body rules, and the choice between skill types: `skill.md`
- The `REQUIREMENT.md` beside the body: `skill-requirement.md`
- Voice, rhythm, and sentence construction: the `write-human` skill
- Punctuation, formatting, and word choice: `markdown.md`

## What a working practice skill looks like

A practice skill works when a session about to cut the practice short meets the answer before it does:

- Does every excuse row name a reason a session has actually given to skip the practice?
- Can a session spot each red flag in its own work while it is still working?
- Can a session run every line of the closing checklist against what it produced, and get a yes or a no?
- Can a reader open each source the ledger names and find the version the body states?

A practice skill failing any of these is non-conforming even when every heading below is present.

## Closing sections

- Close the body with three H2s, after every concern group and in this order: `## Excuses and rebuttals`, `## Red flags`, and `## Before handing over`.
- Spell each heading exactly. An H3, or a heading carrying more words such as `## Red flags that mean start over`, reads as missing.
- Write `## Excuses and rebuttals` as a two-column table pairing a reason a session gives to skip or shortcut the practice with the answer to it. Never write a row rebutting an objection nobody raised, since that row is ceremony. Revisit when a practice skill's table is observed failing to stop an excuse it names.
- Write `## Red flags` as bullets naming signs a session can observe in its own work mid-task, never a restatement of a rule above.
- Write `## Before handing over` as the exit checklist, each line a check against what the session produced.

## Source ledger

- Carry `references/adopted.md` in every practice skill, recording each external source the body draws on.
- Link each source, or pin it to a commit, so a reader can open the version the body adopted.
- State what was adopted, what was declined, and why for each, so a later session extends the position rather than re-deriving it.
- Draw first from the default shelf, [Software Engineering at Google](https://abseil.io/resources/swe-book/html/toc.html) and [Google's engineering practices](https://google.github.io/eng-practices/), and record a source from elsewhere the same way.

## Which skills are practice skills

- `canon claude skills audit` keeps the list of practice skills and checks each listed one for the three closing sections and the ledger.
- Never mark a skill as a practice skill in its own frontmatter, since a self-declared kind lets a skill exempt itself.
- The list names this toolkit's shipped skills alone, so a project's own practice skill takes this shape with no check behind it.
