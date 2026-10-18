---
description: Route edits to a skill body or its requirement to the create-skill skill for the shape, and hold the creation-time questions and the re-read rule
paths:
  - '.claude/skills/**/SKILL.md'
  - 'claude/skills/**/SKILL.md'
  - '.claude/skills/**/REQUIREMENT.md'
  - 'claude/skills/**/REQUIREMENT.md'
---

# Skill standards

## Skill files

- Load the `canon:create-skill` skill before a hand edit to a `SKILL.md` or a `REQUIREMENT.md`, since it carries the skill structure, the requirement shape, and the path rules.
- Report it rather than proceeding silently when `canon:create-skill` does not resolve, as in a project that installed governance without the plugin.
- Confirm `canon:create-skill`'s two creation-time questions are answered before a new `SKILL.md` lands, whoever drafted it, `canon:create-skill` included.
- Carry its third question into the sibling `REQUIREMENT.md`'s `Must not` section as a review criterion rather than a gate.
- Re-read a skill body this session edited before invoking that skill again in the same session. Revisit when Claude Code reloads a skill body edited after the session first invoked it.
- Do not read a resolved file path in a held body as evidence the body is current. Revisit when Claude Code marks a held skill body stale once its source changes.
