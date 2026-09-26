---
title: Claude Code hooks
description: Event hooks, configuration, and behavior control
---

# Claude Code hooks

Hooks are shell commands that run in response to Claude Code events. The harness executes them, not Claude. Use hooks to enforce rules, auto-format files, inject context, or block actions. Source: Anthropic, in the [Claude Code docs](https://code.claude.com/docs).

Configure hooks in `settings.json` under the `hooks` key. Project-level hooks go in `.claude/settings.json` and are shareable via source control. User-level hooks go in `~/.claude/settings.json`.

## Key events

Tool lifecycle:

- `PreToolUse`: fires before a tool call. Can block the action or modify the tool input
- `PostToolUse`: fires after a tool call succeeds. Cannot undo, but can inject feedback to Claude
- `PostToolUseFailure`: fires when a tool execution fails
- `PermissionRequest`: fires when a permission dialog is about to show. Does not run in non-interactive mode
- `PermissionDenied`: fires when the auto-mode classifier denies a tool call

Session and turn lifecycle:

- `SessionStart` / `SessionEnd`: fires when a session begins, resumes, or terminates
- `UserPromptSubmit`: fires when the user submits a prompt. Can block or inject context
- `Stop` / `StopFailure`: fires when Claude finishes a response, or when a turn ends due to API error. `Stop` can block completion to keep Claude working
- `PreCompact` / `PostCompact`: fires around context compaction

Subagents and tasks (see [Claude Code subagents](subagents.md) for when a skill should spawn one):

- `SubagentStart` / `SubagentStop`: fires when a subagent spawns and finishes
- `TaskCreated` / `TaskCompleted`: fires around `TaskCreate` calls

Environment and watching:

- `InstructionsLoaded`: fires when a `CLAUDE.md` or `.claude/rules/*.md` loads
- `ConfigChange`, `CwdChanged`, `FileChanged`: fire on config/working-directory/file changes
- `WorktreeCreate` / `WorktreeRemove`: fire around worktree lifecycle
- `Notification`, `TeammateIdle`, `Elicitation`, `ElicitationResult`: niche events for notifications, agent teams, and MCP elicitation

## Configuration

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "scripts/format.sh"
          }
        ]
      }
    ]
  }
}
```

The `matcher` field is a regex matched against `tool_name`. Omit it to match all tool calls for that event.

Hook input arrives as JSON on stdin. The hook reads it to decide what to do.

## Controlling behavior

**Exit code 2** blocks the action. Write the reason to stderr. Claude receives it as feedback.

```bash
echo "Reason: destructive command blocked" >&2
exit 2
```

**Exit code 0** with JSON on stdout gives structured control:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Policy violation"
  }
}
```

In `Stop` hooks, return `decision: "block"` with a reason to keep Claude working. Claude treats the reason as its next instruction.

## Hook types

- `command`: runs a shell script. Most flexible
- `http`: POSTs JSON to an endpoint. Useful for external services
- `prompt`: single-turn LLM call (Haiku by default). Use when the decision depends only on the hook input
- `agent`: multi-turn subagent with file tools. Use when the decision requires reading files or running commands

## Parallel execution

Multiple matching hooks run in parallel. When hooks conflict, the most restrictive decision wins (`deny` beats `allow`). Identical hook commands are deduplicated.

## Notes

- Deny rules in settings always win. A hook cannot grant permissions that a deny rule blocks
- `PostToolUse` cannot prevent the action. The tool has already run
- `PermissionRequest` does not fire in non-interactive (`-p`) mode. Use `PreToolUse` for automated decisions there
- Hook entries support `if`, `timeout`, `async`, and `once` fields. `if` filters by permission rule pattern so the hook only spawns for matching tool calls
- Shell profile side effects (like `echo` in `~/.zshrc`) can corrupt hook JSON. Guard interactive-only output with `if [[ $- == *i* ]]`
