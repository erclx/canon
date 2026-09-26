---
title: Zshrc aliases for Claude Code
description: Shell aliases that shorten common Claude Code invocations
category: Workflow
---

# Zshrc aliases for Claude Code

Claude Code auto-discovers the toolkit plugin from `claude/.claude-plugin/plugin.json` when run inside the toolkit repository. Outside the toolkit, that discovery does not fire, so a separate set of aliases bakes in `--plugin-dir` explicitly. Two parallel sets cover both cases.

## The aliases

`bun run bootstrap` installs this block. It owns the canonical copy in `scripts/core/bootstrap.sh`, appends it to `~/.zshrc` wrapped in the two marker comments below, and sets `TOOLKIT` to the cloned path. The markers are how a re-run recognizes its own block and skips.

Skipping means a re-run never updates a block already installed, so a shell that ran the bootstrap before the canonical block grew keeps whatever it got that day. To pick up an alias added since, delete the marked block and re-run the bootstrap, or paste the new lines into the block by hand.

A block installed by hand before the managed one has no markers. Bootstrap detects that case through the `alias clp=` line instead, warns, and leaves the block untouched rather than appending a second copy. To switch over, delete the hand-rolled block and re-run the bootstrap.

```zsh
# >>> canon aliases >>>
TOOLKIT="/path/to/toolkit"

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

The block sits after any `PATH` mutations and the `claude` CLI install. Zsh expands aliases recursively on the first word, so `clr`, `clc`, `clw`, and `cls` inherit their base through `cl`, and `clpc`, `clps`, and `clpa` inherit `--plugin-dir` through `clp`. `clpac` inherits it one level further, through `clpa`. `$TOOLKIT` expands at invocation time, so updating the variable and re-sourcing reroutes all `clp` calls without touching the alias definitions.

To opt out, delete the block between the two markers. Bootstrap re-adds it on the next run, so skip that step by running `bun install` and `bun link` yourself instead.

The block itself works unchanged in bash, and what differs is the file it goes in and who writes it. Paste it into `~/.bashrc` by hand, since `bun run bootstrap` appends to `~/.zshrc` alone and a run from a bash shell installs nothing that shell reads. Bash re-checks the first word of an alias expansion the way zsh does, so the `cl` and `clp` chains below still inherit their base, and the `bun install` and `bun link` step above is the opt-out either shell takes.

## What each one does

`cl`, `clw`, and `cls` carry no explicit plugin dir and start a fresh session. Use them inside the toolkit repository, where Claude Code auto-discovers the plugin from `claude/.claude-plugin/plugin.json`. Loading `--plugin-dir` on top of auto-discovery registers every skill twice and produces duplicate entries in the slash command list.

`clr` and `clc` resume a session rather than launching one, so auto-discovery never fires for them. A resume restores whatever plugin registration the session started with and recomputes nothing, which a bare `claude --resume` demonstrated by holding a stale registration through a full process restart until `--plugin-dir` was passed on the resume itself.

- `cl`: plain session in the current directory
- `clr`: opens the `/resume` picker scoped to the current directory. Trailing arguments filter by name. `clr auth` limits results to sessions containing "auth". Resuming does not reload the plugin, so reach for `clpc` when the session needs it.
- `clc`: jumps straight into the most recent session for the current directory. No picker. Faster than `clr` when the terminal closed and you want back into the same session. Resuming does not reload the plugin here either.
- `clw`: creates a worktree under `.claude/worktrees/<name>/` on a fresh branch and starts a Claude Code session in it. Pass the worktree name as the trailing arg: `clw feat-auth`.
- `cls`: pins the session to Sonnet instead of the default Opus. Use for routine work where Opus cost is not justified.

The `clp` family bakes in `--plugin-dir`. Use it outside the toolkit repository, where auto-discovery does not fire, and for any resume that needs the plugin.

- `clp`: session with the toolkit plugin loaded explicitly
- `clpc`: jumps straight into the most recent session for the current directory with the plugin loaded. The `clp` mirror of `clc`, and the one resume that carries the plugin.
- `clps`: `clp` pinned to Sonnet
- `clpa`: opens the agent view with the plugin loaded, covering background sessions from every directory
- `clpac`: the same view filtered to background sessions started under the current directory

## When to use which

Use `cl` by default when working in the toolkit repository. Auto-discovery loads the plugin and the two-key alias keeps it short.

Use `clp` in any other repository where you want the toolkit skills available. Without the flag, those repos do not load the plugin.

Use `cls` or `clps` to save Opus usage on routine sessions. Switch mid-session with `/model` to avoid restarting.

Use `clw <name>` for features that will take more than one session. A worktree isolates the branch, the transcripts, and the `/resume` history. See [Claude Code and git worktrees](../../wiki/claude/worktrees.md) for fan-out rules.

Use `clc` to resume the last session without a picker. Use `clr` when you have several sessions and need to pick by name or recency. Reach for `clpc` over `clc` wherever the resumed session needs the plugin, inside the toolkit repository as well as outside it, since neither resume re-runs discovery.

Use `clpa` to see what is running across every directory, and `clpac` when only the current project matters.

## Why not a function

A function with subcommand dispatch (`cl r`, `cl c`, `cl w foo`) was considered and rejected. It loses shell completion and adds a layer of indirection. Separate aliases are self-contained and the shared `cl`/`clp` prefixes make them easy to recall.
