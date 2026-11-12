---
description: Send a plan that changes CI, hooks, scripts, or a stack's configs and seeds to the plan counterparts section
paths:
  - '.github/**'
  - '.husky/**'
  - '.claude/hooks/**'
  - 'scripts/**'
  - 'tooling/*/configs/**'
  - 'tooling/*/seeds/**'
---

# Plan counterpart standards

## Planning a counterpart change

- Read `## Plan counterparts` in `.claude/skills/internal-tooling/SKILL.md` before planning a change under these paths, since a planner loads no domain skill and the section alone states the check.
- Write the plan as a file at `.canon/plans/feature-<slug>.md` and never in chat, since `canon records validate plans` reads a file alone.
- State a `## Counterparts` bullet for each such path the plan's `## Files to touch` cites, and for a top-level non-markdown root config, which these globs cannot match.
