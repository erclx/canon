---
name: create-rule
description: Why a project-local rule needs a subdir, a number from the band reserved for one, and a scope key that decides when it fires
---

# Create rule requirement

## Gap

Without this skill, a project rule is written straight into the rules folder on a number already taken, so two rules collide and one loses. The subtler collision was with the toolkit itself: a number free in the target today could be the number a shipped rule landed on tomorrow, and the next install double-booked it, so a rule the project wrote got overwritten by one it never chose. Writing under `.claude/rules/project/` closes that half regardless of the number, since the sync engine orphans the file by location before it ever compares names.

Numbering in `900-999` closes the other half. A number scanned against today's toolkit catalog goes stale on the next release, and a reserved band does not.

The subdir gets picked by feel, so a UI copy rule lands in the always-on folder and loads on every session for the rest of the project's life. The scope key fails in both directions. An always-on rule carrying a path scope fires only on files it was never about, and a path-scoped rule missing it loads constantly. Written from memory rather than from the rule standard, the body comes out in a shape the rest of the catalog does not share.

## Must

- Resolve what the rule enforces and where it applies, asking only for what the request leaves missing
- Pick the subdir from the topic and take the folder from that choice
- Write under `.claude/rules/project/`, the subfolder the sync engine reads as project-authored by location
- Take the lowest free number at or above `900`, scanning every project subdir the target holds rather than one
- Read the rule standard before writing the body
- Emit the path scope for a path-scoped rule and omit the key entirely for an always-on one
- Preview the resolved path, subdir, number, and frontmatter, then write without pausing
- Say when the rule loads, since path-scoped and always-on rules behave differently

## Must not

- Edit a toolkit source rule, which is authored in the toolkit and would be overwritten here
- Work the body shape or the frontmatter from memory
- Take a number below `900`, which a later toolkit release can ship into
- Write more than one topic into a single rule

## Guards

- No project Claude directory: stop, since there is nowhere for the rule to live
- The request names no behavior to enforce: stop rather than inventing one
- The reserved band holds no free number: stop rather than reaching below `900`

## Out of scope

- Editing a rule that already exists
- Toolkit source rules, which are authored in the toolkit rather than in a target
- Installing the rules the toolkit ships, which the governance setup path owns
- A standard, which `create-standard` owns
