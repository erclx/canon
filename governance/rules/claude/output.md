---
description: Report file paths correctly for the reading surface and group them when the response covers many
---

# Output standards

## Reporting paths

- After creating or modifying a file, include its path on its own line so the reader can open it. Do not paraphrase paths into prose ("the seeds folder", "your CLAUDE.md").
- Emit a path in the form the surface's own instructions give, such as a markdown link where the harness asks for one, and bare where it gives none. A terminal makes a bare path clickable through its own path detection, and link markup defeats that.
- That form governs a path emitted in a response. A path written into a markdown file follows the markdown standard instead, which your toolkit resolves by name, and which backticks a file reference and never repeats it as a link label.
- In a linked worktree (under `.claude/worktrees/<name>/`), emit the absolute path, since the editor is rooted at the main project root and a path relative to the worktree resolves nowhere there. Prefer the form a `PostToolUse` hook hands back after a write where one is installed.

## Grouping multiple files

- When the response covers multiple files, group paths under headers: `**Created:**`, `**Modified:**`, `**Deleted:**`. Every path under them takes that form, not the first alone. For single-file changes, the path on its own line is enough.
