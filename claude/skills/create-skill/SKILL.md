---
name: create-skill
description: Creates a new `SKILL.md` in `.claude/skills/` in a target project, or in the toolkit's own checkout under `claude/skills/` for a plugin skill and `.claude/skills/` for an `internal-*` one. Use when asked to "create a skill", add a skill, or make a new skill.
metadata:
  family: generate
---

# Create skill

Read these files in parallel:

- `${CLAUDE_SKILL_DIR}/references/skill.md`: skill structure, skill types, frontmatter fields, invocation rules
- `${CLAUDE_SKILL_DIR}/references/skill-requirement.md`: what `REQUIREMENT.md` must answer, its sections, and its template
- `${CLAUDE_SKILL_DIR}/references/skill-paths.md`: which root a path in the body resolves against, and how the body cites another skill's reference
- `${CLAUDE_SKILL_DIR}/references/skill-disclosure.md`: where each reference is named, the contents block, the trigger and guard that stay in the body, and what moves to `references/`
- `${CLAUDE_SKILL_DIR}/references/skill-frontmatter.md`: the frontmatter fields, their limits, and which keys an upload accepts

### Writing standards

Read these in the same pass:

- `${CLAUDE_SKILL_DIR}/../markdown-craft/references/markdown.md`: punctuation and formatting for skill body text
- The `write-human` skill: voice, rhythm, and sentence construction for skill body text

## Further references

- `${CLAUDE_SKILL_DIR}/references/skill-reference.md`, when the skill carries a reference setting the shape of one artifact: its scope, success criterion, frontmatter, and rule phrasing
- `${CLAUDE_SKILL_DIR}/references/skill-practice.md`, when the skill carries engineering practice: the closing sections a practice skill owes and the anatomy behind them

## Guards

- If `${CLAUDE_SKILL_DIR}/references/skill.md` is not present, stop: `❌ skill.md standard not found. Reinstall the canon plugin.`

## Steps

1. Answer three questions in writing before drafting anything.
   - Does a rule, a verb, or an existing skill already reach this moment? A folder that only wraps something already reachable duplicates it rather than adding to the catalog.
   - Does the body carry a procedure a session would get wrong from first principles? A one-line wrapper around a single command needs no skill.
   - Will anything invoke it other than the author typing its name? Carry this into the drafted `REQUIREMENT.md`'s `Must not` section as a review criterion, since nothing answers it before the run.
   - Tell the user and stop when the first answer is yes or the second is no. A non-interactive run stops on both too, reporting which question failed and writing no folder.
2. Draft the full `SKILL.md` from the user's description, stating the current rule alone. An incident and the date it happened stay in git, never in the body, a reference, or the requirement.
3. Draft the sibling `REQUIREMENT.md` from what the skill is for, in the shape the requirement standard states.
   - Write the gaps from the user's description rather than from the drafted body, since a requirement derived from the body records whatever the draft overfitted to.
4. Confirm the skill name and both files with the user before writing, when a person can answer.
   - Skip the confirmation when another skill's run invoked this one, such as `auto-ship`, or when a dispatched worker runs it.
   - Then put the three Step 1 answers and the two drafted paths in the output and continue to Step 5, since a question nobody reads parks the chain.

### Write and check

Steps 5 to 7 write the folder and check what landed before the run reports.

5. Resolve the root, then write `<root>/<name>/SKILL.md` and `<root>/<name>/REQUIREMENT.md`.
   - The root is `.claude/skills/` in a target project.
   - In the toolkit's checkout, which holds `claude/.claude-plugin/plugin.json`, an `internal-*` skill goes under `.claude/skills/` and the rest under `claude/skills/`, since the plugin ships that tree.
6. Run `canon claude skills audit --json` and read `findings.datedProvenance` for rows under `<root>/<name>/`.
   - Cut each row's date and incident from the file the row names, leaving them to git, and re-run until no row names the folder.
   - When `canon` does not resolve or its record carries no `datedProvenance` key, say the check did not run rather than reporting the skill clean.
7. Run `canon markdown audit <root>/<name>/` over the new body and any references, and fix every ban and density finding it reports.
   - Re-run it until it reports none, since every file in the folder is this run's draft.
   - When `canon` does not resolve, say the audit did not run rather than reporting the folder clean.

Every skill carries a requirement. A skill created without one is a gap someone closes in a later sweep, and the sweep has to reconstruct what the skill was for from the body it already shipped.

The two-question check has a shipped precedent:

- A pull request dropped `git-stash` for wrapping a single git command that needed no skill body, which is question one
- It dropped `release-changelog` for being low-frequency and invoked by no other skill, which is question three read back after the fact

That is why the third question stays a review criterion rather than something this skill can gate on.
