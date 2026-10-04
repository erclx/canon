---
title: Claude Code permissions
description: Orientation to permission modes and rules, plus the rule that blocks every subagent
---

# Claude Code permissions

Claude Code checks every tool call against permission rules before it runs, and a permission mode sets which actions run without a prompt. Rules live in `settings.json` under `permissions.allow`, `permissions.ask`, and `permissions.deny`, and a deny at any level wins. See [plan mode](plan-mode.md) for the read-only mode. Source: [Configure permissions](https://code.claude.com/docs/en/permissions.md), with the modes in [Choose a permission mode](https://code.claude.com/docs/en/permission-modes.md).

## Blocking subagents

Deny the `Agent` tool itself to stop Claude from delegating to any subagent:

```json
{
  "permissions": {
    "deny": ["Agent"]
  }
}
```

The bare rule blocks every spawn in every session, attended, unattended, terminal, and desktop alike, because a deny rule does not look at how the session started. A deny in settings also wins over any hook that would allow the call. `claude --disallowedTools "Agent"` does the same for one launch.

The tool was called `Task` before version 2.1.63, and `Task` still works as an alias. Add `"Task"` beside `"Agent"` for a build that may still emit the old name.

Commit the rule in `.claude/settings.json` to block subagents for everyone working in the project. Put it in `.claude/settings.local.json` to block them for yourself only, since that file stays out of version control.
