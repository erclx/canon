---
description: Enforce the CLAUDE.md edit protocol and the test routing a fact into it rather than a rule
paths:
  - 'CLAUDE.md'
---

# CLAUDE.md standards

## Editing

- Show the proposed change as a fenced `diff` block in chat first, then wait for approval before calling the file-editing tool.

## Routing

- Keep a rule here when it applies every session regardless of what is being edited, on firing alone.
- Move a rule into `.claude/rules/` when it fires only on a specific path being edited and violating it ships silently, the same firing axis judged the other way.
- Route a rule failing either half to a context entry or a skill body rather than here. Firing is one axis of three. Conditional presence and updatability are the other two, and this rule states the first alone.
- Name a rule's tier rather than a rule file. A path-scoped rule reaches the session on its own glob and needs no pointer from here.
- Point at a skill by name where one applies. A skill loads only when invoked, so an unreferenced skill is one no session finds.
