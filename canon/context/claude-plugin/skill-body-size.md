---
title: Skill body size
description: The line checkpoint that replaced a word cap nothing reached, the move rule deciding what leaves a body, and the dereference test each move has to pass
---

# Skill body size

`claude/skills/create-skill/references/skill.md` checks a skill body against 150 lines and names what moves to `references/` past it. The number is a prompt rather than a gate, like the context-entry checkpoint. Above it sits the 300 line ceiling from `claude/skills/markdown-craft/references/markdown.md`, binding a body and each reference alike.

- Keeping a procedure-only body whole at any length lost to the Document ceiling stage, which fails a push on a body past 300
- Past the ceiling a whole step moves to a reference, the body keeping the step heading and one line naming the file to read
- The cost is a second read at that step, which the load line carries, and a session that skips the line skips the step

## Decisions

### Why the cap counts lines rather than words

A word cap of 5,000 never forces a single reference, since no skill body approaches it, and a cap that never fires is indistinguishable from no rule.

- Lowering the number would keep the wrong unit, since a body is read as lines on a screen and edited as lines in a diff, and every neighboring checkpoint counts lines
- Words and lines also disagree about weight. A signal table or a stub template is few words and many lines, and those are the blocks worth moving, so the word unit was blind to them

### What the move rule names

A catalog, a table of cases, or a format spec running past roughly fifteen lines goes to `references/` at any body length. Below the ceiling procedure prose stays, since a session sent to a reference for its own steps pays two reads for one job.

### The dereference test

Below the ceiling, each move owes a named branch that skips it. Body lines are paid on every invocation and a reference only when the body sends the session to it, so a block every run dereferences costs a read and saves nothing.

- The body keeps the trigger, the skip condition, and the guard, because a run that never reaches the block has to decide that without opening the reference
- The rebase machinery in `review-address` sits in a reference because a branch that still merges never reaches it, while the reply format it writes on every run stays in the body.

### Applying it is maintenance, not a sweep

A body sitting at the ceiling takes no new line at all, since the Document ceiling stage fails a push past 300 rendered lines whatever the line adds. `role-orchestrator/SKILL.md` sits at exactly 300, so new orchestrator procedure lands in a reference the body already points at, such as `orchestrator-dispatch.md`.

Ten bodies clear the checkpoint. Moving all of them in one pass turns a standards change into a corpus rewrite, so the checkpoint fires on each skill as that skill is next edited.

### Sharing a reference across skills

Pointing one skill at a sibling's folder through a bare relative path is banned, since it resolves against the session cwd and breaks when either skill runs from a plugin cache.

- A reference two skills read lives in its owner skill's `references/` folder
- The other skill cites it through `${CLAUDE_SKILL_DIR}/../<owner>/references/<name>.md`, which resolves off the skill's own folder in every plugin cache

`git-pr` and `git-split` both citing `claude/skills/git-branch/references/branch.md` and `claude/skills/git-pr/references/pr.md` is the shape to expect, with `git-pr` reading its own `pr.md` through `${CLAUDE_SKILL_DIR}/references/pr.md`.

Where that single source lives is a fact about this repository, so the reference states the requirement and stops. `canon/context/claude-plugin/skill-references/overview.md` carries the decision behind one home per reference.
