---
title: Skill body size
description: The line checkpoint that replaced a word cap nothing reached, the move rule deciding what leaves a body, and the dereference test each move has to pass
---

# Skill body size

`standards/skill.md` checks a skill body against 150 lines and names what moves to `references/` past it. The number is a prompt to look rather than a gate, matching the context-entry checkpoint the repository already runs, so nothing enforces it and a body carrying nothing but procedure stays whole at any length.

## Why the cap counts lines rather than words

A word cap of 5,000 never forces a single reference, since no skill body approaches it. A cap that never fires is indistinguishable from no rule, and lowering the word number would keep the wrong unit: a body is read as lines on a screen and edited as lines in a diff, and every neighboring checkpoint in this repository counts lines.

Words and lines also disagree about what a body is heavy with. A signal table or a stub template is few words and many lines, and those are exactly the blocks worth moving, so the word unit was blind to the content the rule exists to catch.

## What the move rule names

A catalog, a table of cases, or a format spec running past roughly fifteen lines goes to `references/`. Procedure prose stays, since a session sent to a reference for its own steps pays two reads for one job.

Each move owes a named branch that skips it. Body lines are paid on every invocation and a reference only when the body sends the session to it, so a block every run dereferences costs a read and saves nothing, and the asymmetry is the entire argument for moving anything. The body keeps the trigger, the skip condition, and the guard, because a run that never reaches the block has to decide that without opening the reference.

That test is what bounds the rule. In `docs-fold`, a project with no wireframe folder skips the wireframe-sweep reference outright, and an architecture record carrying no anchored entry skips the architecture-sweep reference the same way. The rebase machinery in `review-address` sits in a reference because a branch that still merges never reaches it, while the reply format that same skill writes on every run stays in the body, having failed the test.

## Applying it is maintenance, not a sweep

Ten bodies clear the checkpoint. Moving all of them in one pass turns a standards change into a corpus rewrite, so the checkpoint fires on each skill as that skill is next edited and the rest stay as they are. The value is that it applies on every later edit rather than that the corpus is uniform on the day it lands.

Pointing one skill at a sibling's folder is banned outright, since a bare relative path across folders resolves against the session cwd and breaks the moment either skill runs from a plugin cache. A reference two skills read is authored as a standard at the flat root instead, cited from each skill through `${CLAUDE_SKILL_DIR}/../../standards/<name>.md`, which resolves off the `claude/standards` symlink in a plugin cache holding no project files. `git-pr` and `git-split` both citing `standards/branch.md` and `standards/pr.md` this way is the shape to expect.

Where that single source lives is a fact about this repository rather than a rule the standard can carry, so the standard states the requirement and stops. `canon/context/standards/resolution.md` carries the decision behind the fallback citation form.
