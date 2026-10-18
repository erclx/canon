---
name: create-rule
description: Why a project-local rule needs a subdir, a slug free in it, and a scope key that decides when it fires
---

# Create rule requirement

## Gap

Without this skill, a project rule is written straight into the rules folder under a name already taken, so two rules collide and one loses. The subtler collision was with the toolkit itself: a name free in the target today could be the name a shipped rule landed on tomorrow, so a rule the project wrote got overwritten by one it never chose. Writing under `.claude/rules/project/` closes that collision whatever the name, since the sync engine orphans the file by location before it ever compares names, and leaves only a slug taken in the same project subdir to check.

The subdir gets picked by feel, so a UI copy rule lands in the always-on folder and loads on every session for the rest of the project's life. The scope key fails in both directions. An always-on rule carrying a path scope fires only on files it was never about, and a path-scoped rule missing it loads constantly. Written from memory rather than from the rule standard, the body comes out in a shape the rest of the catalog does not share.

## Must

- Resolve what the rule enforces and where it applies, asking only for what the request leaves missing
- Pick the subdir from the topic and take the folder from that choice
- Write under `.claude/rules/project/`, the subfolder the sync engine reads as project-authored by location
- Take a slug no rule in the chosen project subdir uses and that equals no subdir name
- Read the rule standard before writing the body
- Hold the body to the rule standard's shape limits on words, bullets, sections, and bullet length
- Apply the content test, leaving out what Claude already knows, what the toolchain enforces, and what changes often
- Check what canon ships for the topic before authoring
- Check the installed skills for one already covering the topic and point the rule at it, skipping the check when none are listed
- Run every written bullet through the checklist and fix what fails before reporting
- Tell the user to cite a source in the commit that adds a rule claiming outside practice
- Emit the path scope for a path-scoped rule and omit the key entirely for an always-on one
- Preview the resolved path, subdir, slug, and frontmatter, then write without pausing, since the diff follows the write
- Show the written rule as a diff and leave the commit to the operator's OK
- Say when the rule loads, since path-scoped and always-on rules behave differently

## Must not

- Edit a toolkit source rule, which is authored in the toolkit and would be overwritten here
- Work the body shape or the frontmatter from memory
- Overwrite a project rule already holding the slug
- Write more than one topic into a single rule

## Guards

- No project Claude directory: stop, since there is nowhere for the rule to live
- The request names no behavior to enforce: stop rather than inventing one
- The topic's slug is taken in the chosen subdir: stop and propose a narrower one

## Out of scope

- Editing a rule that already exists
- Toolkit source rules, which are authored in the toolkit rather than in a target
- Installing the rules the toolkit ships, which the governance setup path owns
