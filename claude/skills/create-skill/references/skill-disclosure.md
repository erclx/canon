---
title: Skill disclosure reference
description: Keeping a skill body and its references under the ceiling, what moves to references and what stays in the body, and how the body names a reference
---

# Skill disclosure reference

Applies to the size and split of every `SKILL.md` and every file under a skill's `references/`.

## Rules

- Keep `SKILL.md` and each file under `references/` at or under the 300 rendered line ceiling `markdown.md` sets for a whole document. The ceiling binds procedure as much as reference material.
- Look at a body once it passes 150 lines. That number prompts a look and gates nothing.
- Move a catalog, a table of cases, or a format spec running past roughly 15 lines to `references/` at any body length.
- Below the ceiling, name the branch that skips a block before moving it. A block every run dereferences costs a read and saves nothing.

### Moving a step

Past the ceiling, move a whole step to a reference, preferring a step a named branch skips.

- Keep the step heading in the body with one line naming the file to read on reaching it, so the body still shows every step in order
- Name every file under `references/` in the body at the point a session reads it, since an unnamed reference is never loaded

### Contents, triggers, and citations

A reference is read from the top, and only when the body sends a session to it.

- Open a file under `references/` running over 100 lines with a `## Contents` H2 of anchor links after its H1 and intro, so a session that reads only the top of the file still sees everything it holds.
- Keep the trigger, the skip condition, and the guard in the body. A run that never reaches the block has to decide that without opening the reference.
- Point one skill at a sibling skill's reference by the form `skill-paths.md` states, `${CLAUDE_SKILL_DIR}/../<skill>/references/<name>.md`, and name the owner rather than copying the file.
