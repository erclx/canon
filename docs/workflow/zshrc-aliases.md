---
title: Zshrc aliases for Claude Code
description: Shell aliases that shorten common Claude Code invocations
category: Workflow
---

# Zshrc aliases for Claude Code

Claude Code auto-discovers the toolkit plugin inside the toolkit repository. Outside it, the `clp` aliases pass `--plugin-dir` explicitly.

## The aliases

`bun run bootstrap` appends this block to `~/.zshrc` between the two marker comments and sets `TOOLKIT` to the cloned path. A re-run skips a block it finds and never updates it. To pick up a newer alias, delete the marked block and re-run, or paste the new lines in.

A hand-written block without markers is detected through its `alias clp=` line, and bootstrap warns and leaves it. Delete it and re-run to switch.

```zsh
# >>> canon aliases >>>
TOOLKIT="/path/to/toolkit"
export CLAUDE_CODE_ENABLE_TODO_TOOLS=1

alias cl='claude'
alias clr='cl -r'
alias clc='cl -c'
alias clw='cl -w'
alias cls='cl --model sonnet'

alias clp='claude --plugin-dir $TOOLKIT/claude'
alias clpc='clp -c'
alias clps='clp --model sonnet'
alias clpa='clp agents'
alias clpac='clpa --cwd .'
# <<< canon aliases <<<
```

The export gives a session started from your terminal the task tools, which Claude Code reads before it starts, so workers and reviewers can show their checklist on `Ctrl+T`. A background session has them without it.

To opt out, delete the block and run `bun install` and `bun link` yourself. Bash takes the block unchanged in `~/.bashrc`, pasted by hand. Bootstrap writes `~/.zshrc` alone.

## What each one does

- `cl`: plain session in the current directory
- `clr`: opens the `/resume` picker for the current directory. `clr auth` filters to sessions containing "auth".
- `clc`: resumes the most recent session for the current directory, no picker
- `clw`: creates a worktree under `.claude/worktrees/<name>/` on a fresh branch and starts a session there, as in `clw feat-auth`
- `cls`: pins the session to Sonnet

The `clp` family loads the plugin explicitly.

- `clp`: session with the toolkit plugin loaded
- `clpc`: resumes the most recent session with the plugin loaded
- `clps`: `clp` pinned to Sonnet
- `clpa`: opens the agent view with the plugin loaded, across every directory
- `clpac`: the same view filtered to the current directory

## When to use which

Use `cl` inside the toolkit repository and `clp` in any other repository that needs the toolkit skills. A resume does not reload the plugin, so use `clpc` over `clc` wherever the resumed session needs it.

- Use `cls` or `clps` for routine sessions, and `/model` to switch mid-session
- Use `clw <name>` for features that take more than one session. See [Claude Code and git worktrees](../../wiki/claude/worktrees.md) and [Parallel features](parallel-features.md).
- Use `clc` to resume without a picker and `clr` to pick by name
- Use `clpa` for every directory and `clpac` for the current project
