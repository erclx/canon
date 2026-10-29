---
description: Route edits to a rule file to the create-rule skill for its shape and checklist
paths:
  - '.claude/rules/project/**/*.md'
  - 'governance/rules/**/*.md'
  - 'internal/rules/**/*.md'
---

# Rule standards

## Rule files

- Load the `canon:create-rule` skill before a hand edit to a rule, since it carries the frontmatter, the shape limits, and the bullet checklist.
- Report it rather than proceeding silently when `canon:create-rule` does not resolve, as in a project that installed governance without the plugin.
- Run `canon gov audit` over each rule the edit touched before committing it.
