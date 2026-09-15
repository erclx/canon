---
description: Keep the toolkit root CLAUDE.md and its seed mirrored
paths:
  - 'CLAUDE.md'
  - 'tooling/claude/seeds/CLAUDE.md'
---

# CLAUDE.md seed standards

## The root and seed pair

- Check the sibling in the same change. Editing the root means checking `tooling/claude/seeds/CLAUDE.md`, and editing the seed means checking the root. Nothing compares the two.
- Route a project-agnostic rule to a core governance rule rather than to either file. Behavior, scope discipline, worktrees, and scratch structure reach a target that way, and a rule keeps receiving fixes where a seed line freezes at scaffold.
- Keep a rule in the seed only when a target that installed the seed without governance would lose the instruction, such as reading a context entry before domain work.
- Keep a toolkit-specific rule at the root alone. The domain skill table, the agent-first design principles, and tool-agnosticism never reach the seed.
- Send a toolkit-specific rule that fires only on a path to `internal/rules/` rather than the root. Wiki policy and authoring layout left the root that way.
- Leave the seed's copy of a rule this file states in place when the rule moves here. This rule reaches no target, so the seed bullet is what a target gets.
- Name the capability a seed line needs rather than the toolkit binary supplying it. A scaffolded project reads the seed as instruction about itself and may not have `canon` installed, so a citation there hands it a verb it cannot run. `scripts/core/check-seed-independence.sh` fails the push when one reaches seed prose.
