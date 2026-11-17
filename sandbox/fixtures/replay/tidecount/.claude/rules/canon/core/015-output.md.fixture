---
description: Report file paths correctly for the reading surface and group them when the response covers many
---

# Output standards

## Reporting paths

- After creating or modifying a file, include its path on its own line so the reader can open it. Do not paraphrase paths into prose ("the seeds folder", "your CLAUDE.md").
- Read `CLAUDE_CODE_ENTRYPOINT` once, at the first response that emits a path, and reuse it for the rest of the session. The surface cannot change mid-session, so a second read only confirms the first.
- When it reads `claude-desktop`, emit each path as a markdown link carrying the path as its text and an absolute `file://` URI as its target, resolving a relative path against the main project root to build that target. The desktop file tree hides dotted folders, so a bare path into one names a file the reader cannot reach.
- On every other value, including unset, emit the path bare. A terminal emulator makes it clickable through its own path detection, and link markup defeats that.
- Both forms govern a path emitted in a response. A path written into a markdown file follows the markdown standard instead, which your toolkit resolves by name, and which backticks a file reference and never repeats it as a link label.
- Use the path the user's editor can resolve. The editor is rooted at the main project root.
- In the main worktree: relative from `pwd` works because `pwd` equals the editor root.
- In a linked worktree (under `.claude/worktrees/<name>/`): use absolute paths. Relative paths from worktree `pwd` would not resolve against the editor's project root. A `PostToolUse` hook computes this form after each write and hands it back as additional context where it is installed. Prefer that form when it arrives, and fall back to computing the absolute path yourself when it does not.

## Grouping multiple files

- When the response covers multiple files, group paths under headers: `**Created:**`, `**Modified:**`, `**Deleted:**`. Every path under them takes the form the entrypoint selected rather than the first alone. For single-file changes, the path on its own line is enough.
