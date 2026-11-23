---
description: Send a plan that changes a CLI verb's command file to the plan callers section
paths:
  - 'src/commands/**'
---

# Plan callers standards

## Planning a verb change

- Read `## Plan callers` in `.claude/skills/internal-scripts/SKILL.md` before planning a change under these paths, since a planner loads no domain skill and the section alone states the check.
- Write the plan as a file at `.canon/plans/feature-<slug>.md` and never in chat, since `canon records validate plans` reads a file alone.
- State a `## Callers` bullet for each skill that runs a verb the plan's `## Files to touch` changes, listed by `canon claude skills callers <verb>`.
