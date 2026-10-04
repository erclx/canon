---
title: Claude Code memory
description: Orientation for how Claude Code carries instructions and learnings across sessions
---

# Claude Code memory

Claude Code carries knowledge across sessions through two mechanisms: `CLAUDE.md` files you write, and auto-memory notes Claude writes itself. `CLAUDE.md` files load by walking up from the working directory, `.claude/rules/` files can scope to paths, and both are context rather than enforced configuration. Source: [How Claude remembers your project](https://code.claude.com/docs/en/memory.md).

The toolkit keeps its own session memory under `.canon/memory/` rather than in auto-memory, and routes a domain fact to a context entry instead. The ship chain's use of it is in [AI workflow](../../docs/workflow/ai-workflow.md#memory-in-the-chain).
