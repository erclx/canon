---
description: Report file paths correctly for the reading surface, group them when the response covers many, and name sessions to a person
---

# Output standards

## Reporting paths

- After creating or modifying a file, include its path on its own line so the reader can open it. Do not paraphrase paths into prose ("the seeds folder", "your CLAUDE.md").
- Emit a path in the form the surface's own instructions give, such as a markdown link where the harness asks for one, and bare where it gives none.
- Never add link markup where the surface gives no form, since a terminal makes a bare path clickable through its own path detection and the markup defeats it.
- Backtick a path written into a markdown file and never repeat it as a link label, per the markdown standard. The response form above governs a response alone.
- Emit the absolute path from a linked worktree (under `.claude/worktrees/<name>/`), since the editor is rooted at the main root, where a worktree-relative path resolves nowhere.
- Prefer the form a `PostToolUse` hook hands back after a write where one is installed.

## Grouping multiple files

- Group paths under `**Created:**`, `**Modified:**`, and `**Deleted:**` headers when the response covers multiple files, with every path under them in that form.
- Put a single-file change's path on its own line, with no header.

## Naming sessions

- Name a session to a person by its roster name from `canon sessions list`, and give its id only beside the name, never alone.
