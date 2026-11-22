---
description: Route a project convention to a project rule rather than CLAUDE.md, and edits to a rule file to the create-rule skill
paths:
  - 'CLAUDE.md'
  - '.claude/rules/project/**/*.md'
---

# Rule standards

## Project conventions

- Add a new project convention as a project rule through `canon:create-rule` rather than a new `CLAUDE.md` section, unless `CLAUDE.md` names another owner for it.

## Rule files

- Load the `canon:create-rule` skill before a hand edit to a rule, since it carries the frontmatter, the shape limits, and the bullet checklist.
- Report it rather than proceeding silently when `canon:create-rule` does not resolve, as in a project that installed governance without the plugin.
- Run `canon gov audit` over each rule the edit touched before committing it.
