---
name: create-rule
description: Why a project-local rule needs a subdir, a slug free in it, and a scope key that decides when it fires
---

# Create rule requirement

## Gap

Without this skill, a project rule is written into the rules folder under a name already taken, or one a shipped rule claims later and overwrites. Writing under `.claude/rules/project/` closes that by location, leaving only a slug taken in the same subdir to check.

The subdir gets picked by feel, so a UI copy rule loads on every session. The scope key fails both ways, with an always-on rule carrying a path scope and a path-scoped rule missing one. Written from memory, the body also drifts from the rule standard's shape.

## Must

- Resolve what the rule enforces and where it applies, asking only for what the request leaves missing, and stop when it names no behavior
- Write under `.claude/rules/project/` in a subdir picked from the topic, with a slug no rule in that subdir uses, and propose a narrower slug when it is taken
- Read the rule standard before writing, then hold the body to its shape limits and content test and run every bullet through its checklist before reporting
- Emit the path scope for a path-scoped rule and omit the key for an always-on one, and say when the rule loads
- Point the rule at an installed skill already covering the topic, and tell the user to cite a source in the commit when the rule claims outside practice

## Must not

- Edit a toolkit source rule, which is authored in the toolkit and would be overwritten here
- Work the body shape or the frontmatter from memory
- Overwrite a project rule already holding the slug
- Write more than one topic into a single rule

## Out of scope

- Editing a rule that already exists, which the rule standard governs
- Toolkit source rules, which the toolkit authors rather than a target
- Installing the rules the toolkit ships, which `target-setup` owns
