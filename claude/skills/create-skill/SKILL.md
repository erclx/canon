---
name: create-skill
description: Creates a new `SKILL.md` in `.claude/skills/` in a target project, or in `claude/skills/` in the toolkit's own checkout. Use when asked to "create a skill", add a skill, or make a new skill.
metadata:
  family: generate
---

# Create skill

Read these files in parallel:

- `${CLAUDE_SKILL_DIR}/../../standards/skill.md`: skill structure, skill types, frontmatter fields, invocation rules
- `${CLAUDE_SKILL_DIR}/references/skill-requirement.md`: what `REQUIREMENT.md` must answer, its sections, and its template
- `${CLAUDE_SKILL_DIR}/references/skill-paths.md`: which root a path in the body resolves against, and how the body cites a standard
- `${CLAUDE_SKILL_DIR}/../markdown-craft/references/markdown.md`: punctuation and formatting for skill body text
- `${CLAUDE_SKILL_DIR}/references/skill-practice.md`, when the skill carries engineering practice: the closing sections a practice skill owes and the anatomy behind them
- The `write-human` skill: voice, rhythm, and sentence construction for skill body text

## Guards

- If `${CLAUDE_SKILL_DIR}/../../standards/skill.md` is not present, stop: `❌ skill.md standard not found. Reinstall the canon plugin.`

## Steps

1. Answer three questions in writing before drafting anything. Tell the user and stop if a rule, a verb, or an existing skill already reaches this moment, or if the body carries no procedure a session would get wrong from first principles. A non-interactive run stops on both too, reporting which question failed and writing no folder:
   - Does a rule, a verb, or an existing skill already reach this moment? A folder that only wraps something already reachable duplicates it rather than adding to the catalog.
   - Does the body carry a procedure a session would get wrong from first principles? A one-line wrapper around a single command needs no skill.
   - Will anything invoke it other than the author typing its name? Carry this one into the drafted `REQUIREMENT.md`'s `Must not` section as a review criterion instead, since nothing can answer it before the skill has run.
2. Draft the full `SKILL.md` from the user's description, stating the current rule alone. An incident and the date it happened belong in the requirement's `Gap`, not in the body or a reference.
3. Draft the sibling `REQUIREMENT.md` from what the skill is for, in the shape the requirement standard states. Write the gaps from the user's description rather than from the drafted body, since a requirement derived from the body records whatever the draft overfitted to.
4. Confirm the skill name and both files with the user before writing, when a person can answer. Skip the confirmation when `CANON_NON_INTERACTIVE=1` is set or another skill's run invoked this one, such as `auto-ship` or a dispatched worker. Then put the three Step 1 answers and the two drafted paths in the output and continue to Step 5, since a question nobody reads parks the chain.
5. Resolve the root, then write `<root>/<name>/SKILL.md` and `<root>/<name>/REQUIREMENT.md`. The root is `claude/skills/` where the project root holds `claude/.claude-plugin/plugin.json`, which is the toolkit's own checkout, and `.claude/skills/` otherwise. In a toolkit checkout `.claude/skills/` is the generated copy, so never author there.
6. Run `canon claude skills audit --json` and read `findings.datedProvenance` for rows under `<root>/<name>/`. Move each row's incident into `REQUIREMENT.md` under `Gap`, cut the date from the file the row names, and re-run until no row names the folder.
   - When `canon` does not resolve or its record carries no `datedProvenance` key, say the check did not run rather than reporting the skill clean.

Every skill carries a requirement. A skill created without one is a gap someone closes in a later sweep, and the sweep has to reconstruct what the skill was for from the body it already shipped.

The two-question check has a shipped precedent. A pull request dropped `git-stash` for wrapping a single git command that needed no skill body, and `release-changelog` for being low-frequency and invoked by no other skill. The first is question one, and the second is question three read back after the fact, which is why it stays a review criterion rather than something this skill can gate on.
