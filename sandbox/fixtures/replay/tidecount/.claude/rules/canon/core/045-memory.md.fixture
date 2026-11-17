---
description: Keep memory writes scoped to .canon/memory/ and out of context-owned domains
---

# Memory standards

## Writing memory

- Write all memory files to `.canon/memory/`, not `~/.claude/projects/`
- A fact about a domain goes to that domain's `canon/context/` entry, not to memory. `canon:memory-capture` routes it there and `canon:docs-fold` folds it in. Memory keeps only what no context entry owns. Report it rather than proceeding silently when either skill does not resolve. Both ship with the plugin and this rule ships with the CLI, so a project that installed governance alone does not have them.
- Never delete a memory entry. Retire one by moving it to `.canon/memory/archive/`, which `canon records push` backs. A bulk retire runs through the shell, where no file edit fires a path-scoped rule.
- Follow the memory standard for the filename and type prefix, the frontmatter, the body shape each type carries, and the lifecycle. Read it with `canon standards memory`. Check every entry in the pen against that standard and fix what breaks it, since nothing keeps the folder conforming on its own.
