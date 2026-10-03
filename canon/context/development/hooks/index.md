---
title: Hooks
subtitle: Where shell scripts and hooks live, the tool-call guards, the compaction and turn hooks, the session budget settings, and the husky git hooks. Start with overview.
---

# Hooks

Where shell scripts and hooks live, the tool-call guards, the compaction and turn hooks, the session budget settings, and the husky git hooks. Start with overview.

- [Compaction and turn hooks](compaction.md): The PreCompact handoff hook and its manual and automatic channels, what the client does with a blocked automatic compaction, the silent turn hook on Stop, and driving a compaction spike
- [Guards](guards.md): The bounded stdin read every payload hook opens with, the path form hook, the bare flag repair, the pull-request creation log, and the unattended agent guard
- [Husky hooks](husky.md): What each git hook runs, the five post-merge steps and their order, the POSIX sh errexit constraint, the second shellcheck run, and stripping inherited git variables
- [Overview](overview.md): Where shell scripts and hooks live, the eight hooks shared with the seed, the audit hook's unresolved dependencies, the dev command reminder, and linting both hook trees
- [Session budget settings](settings.md): The three Claude Code settings bounding a long session's cost that the repository records without setting, being autoCompactWindow, autoContinueAtUsageLimit, and crossSessionInbound
