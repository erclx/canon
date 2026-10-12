---
title: Overview
description: Where a shape reference lives, why each sits with the skill writing its artifact rather than in a shared corpus, how a rule reaches one at path time, and which file records the decisions behind each family
---

# Overview

## Overview

A shape reference is a file under a skill's `references/` that fixes the shape of one artifact, such as a plan, a task, a pull request body, or a glossary. Several of them carry a decision their own text does not explain. The reference states the rule, and the entry here states the measurement or the rejected alternative behind it, so a reader proposing a change can argue against the reason rather than the wording.

## Layout

- `claude/skills/*/references/` owns every shape reference these decisions constrain
- `claude/skills/create-skill/references/` owns `skill-reference.md`, the shape every reference follows
- `governance/rules/` owns the hand-written rules that route a path to a reference's owner skill

Each file covers one family:

- `canon/context/claude-plugin/skill-references/authoring.md`: the template, the success criterion, scope statements, the sibling section a new rule falsifies, and the markdown ban set
- `canon/context/claude-plugin/skill-references/plan.md`: the plan reference, its answer contract, execution-time deviations, constraint expiry, and the branch description cap plans feed
- `canon/context/claude-plugin/skill-references/tasks.md`: the tasks readiness test, the board split, and the origin and archiving rationale
- `canon/context/claude-plugin/skill-references/publish.md`: the cross-reference form, the destination test, and the two title checks
- `canon/context/claude-plugin/skill-references/surfaces.md`: teach and glossary, Mermaid, and when a reference earns a drafting skill

## Decisions

### One home per reference

Every reference lives in the skill that writes its artifact. A body or a reference in another skill that reads it cites the sibling path `${CLAUDE_SKILL_DIR}/../<owner>/references/<name>.md`, which resolves in the plugin cache with no copy and no lookup. `claude/skills/create-skill/references/skill-paths.md` states the citation form.

The alternative that lost was a flat `standards/` corpus at the repository root, reached through a `canon standards <name>` verb, a plugin symlink, and pointer rules a generator wrote from each standard's frontmatter. Its case was zero copies: one file served any number of readers, where a generated copy per consumer would have landed the most-cited standard in 21 skill bodies. Measured at `16a80339` on 2026-08-25. Sibling paths reach the same zero copies without a second tree, so the corpus kept a verb, a symlink, and a generator alive to buy nothing a sibling path does not already give, and it lost to one home per fact.

### The path-time channel

A skill reaches its references when it runs, and a session editing an artifact by hand runs no skill. Four hand-written rules close that gap for the artifacts edited most often outside a skill run, being `governance/rules/canon/plan.md`, `governance/rules/canon/tasks.md`, `governance/rules/canon/context.md`, and `governance/rules/claude/skill.md`. Each loads its owner skill by its `canon:` name and carries the few directives that ship silently when violated. `canon/context/governance/routing.md` carries why a rule loads the skill rather than citing the file, and the cap on directives beside the pointer.

## Gotchas

- A reference that names the authoring repository's own paths reads correctly here and is wrong in every target. `claude/skills/create-skill/references/skill-reference.md` bans it under `## Staying inside it`.
