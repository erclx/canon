---
title: Claude Code permissions
description: Modes, allow/ask/deny rules, and rule syntax
---

# Claude Code permissions

Claude Code evaluates every tool call against permission rules before executing. Rules are checked in order: deny beats ask beats allow. The first match wins. Source: Anthropic, in the [Claude Code docs](https://code.claude.com/docs).

## Permission modes

Set the active mode with `--permission-mode <mode>` or `permissions.defaultMode` in `settings.json`.

- `default`: prompts before writes and shell commands. Reads are approved on first encounter per session
- `acceptEdits`: auto-approves file edits and common filesystem commands (`mkdir`, `touch`, `rm`, `mv`, `cp`, `sed`) within the working directory or `additionalDirectories`. Still prompts for other bash, network requests, and protected paths
- `plan`: reads and explores only. Proposes changes without executing them. See [plan mode](plan-mode.md)
- `auto`: auto-executes with a background safety classifier. Requires Team, Enterprise, or API plan, Sonnet 4.6 or Opus 4.6 on the Anthropic API, and admin opt-in on Team or Enterprise
- `dontAsk`: auto-denies anything not explicitly allowed. Fully non-interactive. Useful for locked-down CI pipelines
- `bypassPermissions`: all operations execute immediately except writes to protected paths. Use only in isolated containers

`--dangerously-skip-permissions` is an alias for `bypassPermissions`.

## Allow, ask, and deny rules

Configure rules in `settings.json` under `permissions.allow`, `permissions.ask`, and `permissions.deny`.

```json
{
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": ["Bash(npm run build)", "Bash(git commit *)", "Edit(/src/**)"],
    "deny": ["Bash(git push *)", "Edit(.env)"]
  }
}
```

## Rule syntax

Rules follow the format `Tool` or `Tool(specifier)`. Omit the specifier to match all uses of a tool.

**Bash specifiers** match command strings with glob support:

- `Bash(npm run build)`: exact match
- `Bash(npm run test *)`: command plus any arguments
- `Bash(git * main)`: any git subcommand targeting main

**File specifiers** use gitignore-style patterns with path roots:

- `Edit(/src/**/*.ts)`: relative to project root
- `Edit(./.env)`: relative to working directory
- `Edit(~/.zshrc)`: relative to home directory
- `Read(//etc/hosts)`: absolute path (double slash)

**Other tools:**

- `WebFetch(domain:example.com)`: match by domain
- `mcp__servername__toolname`: specific MCP tool
- `mcp__servername__*`: all tools from an MCP server
- `Agent(AgentName)`: restrict subagent invocations
- `Skill(name)` or `Skill(name *)`: control which skills Claude can invoke

`additionalDirectories` (in settings) extends file-access scoping for `acceptEdits` auto-approval.

## Protected paths

Writes to these paths are never auto-approved. In `default`, `acceptEdits`, `plan`, and `bypassPermissions` they still prompt. In `auto` they route to the classifier. In `dontAsk` they are denied.

Directories: `.git`, `.vscode`, `.idea`, `.husky`, `.claude` (except `.claude/commands`, `.claude/agents`, `.claude/skills`, and `.claude/worktrees`).

Files: `.gitconfig`, `.gitmodules`, `.bashrc`, `.bash_profile`, `.zshrc`, `.zprofile`, `.profile`, `.ripgreprc`, `.mcp.json`, `.claude.json`.

## Precedence

Deny rules at any level block execution. Allow rules at lower levels cannot override denies at higher levels. Settings load in this order, with earlier entries taking precedence: managed policy, CLI args, `.claude/settings.local.json`, `.claude/settings.json`, `~/.claude/settings.json`.

## Auto mode classifier

In `auto` mode, a separate Sonnet 4.6 classifier reviews each non-trivial action before it runs and blocks anything that looks like an escalation, hostile-content-driven action, or change to unrecognized infrastructure. Read-only actions and edits inside the working directory bypass the classifier.

Tune the classifier in settings under `autoMode`:

- `allow`: extra rules the classifier should permit
- `soft_deny`: extra rules to flag and block
- `environment`: trusted hosts, repos, buckets, and services

Run `claude auto-mode defaults` to dump the built-in rule set, and `claude auto-mode config` to see your effective config. The mode auto-pauses after 3 consecutive blocks or 20 total in a session.

## Auto mode vs allowlist

Auto mode and the allowlist are complementary, not substitutes. Auto mode approves non-trivial actions through a classifier that can still block or require manual override. Allowlist entries in `settings.json` pre-approve specific commands unconditionally, skipping both the prompt and the classifier.

Common read-only shell commands never need an allowlist entry. Claude Code auto-allows `ls`, `cat`, `head`, `tail`, `grep`, `rg`, `find`, `jq`, all git read-only subcommands (`status`, `diff`, `log`, `show`, `branch`, `remote`, `rev-parse`, etc.), all `gh` read-only subcommands (`pr view/list/diff`, `issue view/list`, `run view/list`), and Docker read-only subcommands (`ps`, `images`, `logs`, `inspect`). Allowlist entries are for project-specific scripts that Claude Code cannot otherwise recognize as read-only, such as `Bash(bun run check:spell)`.

## Hook-based extensions

[`PreToolUse` and `PermissionRequest` hooks](hooks.md) can grant, deny, or rewrite permission decisions programmatically. Use them when rule patterns alone are not expressive enough.
