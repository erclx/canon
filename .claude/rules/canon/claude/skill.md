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

- Load the `canon:create-skill` skill before a hand edit to a `SKILL.md` or a `REQUIREMENT.md`. It carries the skill structure, the requirement shape, and the path rules for a skill body. Report it rather than proceeding silently when the skill does not resolve. It ships with the plugin and this rule ships with the CLI, so a project that installed governance alone does not have it.
- Confirm `canon:create-skill`'s two creation-time questions are answered before a new `SKILL.md` lands, whether drafted by hand, by another skill, or by `canon:create-skill` itself. Carry the third question into the sibling `REQUIREMENT.md`'s `Must not` section as a review criterion rather than a gate.
- Re-read a skill body this session edited before invoking that skill again in the same session.
- Do not read a resolved file path in a held body as evidence the body is current.
