---
title: Overview
description: Where a shape reference lives, why it sits with its skill, how a rule reaches one at path time, and where each family's decisions are recorded
---

# Overview

## Overview

A shape reference is a file under a skill's `references/` that fixes the shape of one artifact, such as a plan, a task, a pull request body, or a glossary. The reference states the rule. The entries here state the measurement or rejected alternative behind it, so a reader proposing a change can argue against the reason rather than the wording.

## Layout

- `claude/skills/*/references/` owns every shape reference these decisions constrain
- `claude/skills/create-skill/references/` owns `skill-reference.md`, the shape every reference follows
- `governance/rules/` owns the hand-written rules that route a path to a reference's owner skill

Each file in this folder covers one family.

- `canon/context/claude-plugin/skill-references/authoring.md`: the template, the success criterion, scope statements, and the markdown ban set
- `canon/context/claude-plugin/skill-references/plan.md`: the plan reference, answer contract, deviations, constraint expiry, and branch cap
- `canon/context/claude-plugin/skill-references/tasks.md`: the readiness test, the board split, and the origin and archiving rationale
- `canon/context/claude-plugin/skill-references/publish.md`: the cross-reference form, the destination test, and the two title checks
- `canon/context/claude-plugin/skill-references/surfaces.md`: teach and glossary, Mermaid, and when a reference earns a drafting skill

## Decisions

### One home per reference

Every reference lives in the skill that writes its artifact. A skill reading another's reference cites the sibling path `${CLAUDE_SKILL_DIR}/../<owner>/references/<name>.md`, which resolves in the plugin cache with no copy. `claude/skills/create-skill/references/skill-paths.md` states the form.

The rejected alternative was a flat `standards/` corpus at the repository root. It needed a `canon standards <name>` verb, a plugin symlink, and generated pointer rules.

- Its case was zero copies, where a generated copy per consumer would have put the most-cited standard in 21 skill bodies (measured at `16a80339` on 2026-08-25)
- Sibling paths reach zero copies without a second tree, so the corpus kept three mechanisms alive to buy nothing

### The path-time channel

A skill reaches its references when it runs, and a session editing an artifact by hand runs no skill. Four hand-written rules close that gap for the artifacts edited most often outside a skill run.

- `governance/rules/canon/plan.md`
- `governance/rules/canon/tasks.md`
- `governance/rules/canon/context.md`
- `governance/rules/claude/skill.md`

Each loads its owner skill by its `canon:` name and carries the few directives that ship silently when violated. `canon/context/governance/routing.md` carries why a rule loads the skill rather than citing the file, and the cap on directives beside the pointer.

## Gotchas

- A reference naming this repository's own paths reads correctly here and is wrong in every target, so `skill-reference.md` bans it under `## Staying inside it`
