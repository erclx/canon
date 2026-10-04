---
title: Claude Code and git worktrees
description: Orientation and toolkit lessons for running parallel sessions in git worktrees
---

# Claude Code and git worktrees

A git worktree is a separate working directory on its own branch, so each worktree gets its own Claude Code session scope. Two worktrees run two independent sessions in parallel. Claude Code creates one with `--worktree`, enters one mid-session with `EnterWorktree`, or works in one made by plain `git worktree add`. Source: [Run parallel sessions with worktrees](https://code.claude.com/docs/en/worktrees.md). Worktrees themselves are a Git feature.

## Entry can mark the repository bare

`EnterWorktree` sometimes writes `core.bare = true` into the parent repository's shared config, and `ExitWorktree` does not restore it. Config is shared across every worktree, so the flag outlives the session that set it and reaches sessions that never entered a worktree at all.

Nothing surfaces at entry, because the linked worktree keeps working normally. The next command run from the main checkout fails instead:

```plaintext
fatal: this operation must be run in a work tree
```

The files are untouched on disk. Recovery is one line, and it works from any worktree of the repository because the write lands in the shared config:

```bash
git config core.bare false
```

`core.bare = true` on a repository whose root holds a `.git` directory is always this defect. A genuinely bare repository keeps its objects at the root and has no `.git` directory, which is the test worth automating.

Tracked upstream as `anthropics/claude-code#58345`, closed as not planned after a duplicate sweep, with `#45201` and `#45645` as sibling reports. All three describe the harness writing to shared config where worktree-local config belongs. Making the config file immutable at the filesystem level does stop the corruption, but it also blocks git's own legitimate writes, so prefer the repair over the lock.

## Wrap entry in a skill

The `EnterWorktree` and `ExitWorktree` tool descriptions require an instruction trail before invocation: a user request, a `CLAUDE.md` rule, or a memory entry. A skill body is that trail, which is why the toolkit wraps entry in the `session-worktree` plugin skill rather than calling the tool bare.

## Shared scratch sits outside the worktree

The gitignored `.canon/` scratch folders live at the main worktree root, and the isolation checks refuse an editing-tool write there while reads resolve normally. An agent that accepts the redirect the refusal offers reports success and leaves the file where no later session looks. The rule that carries the fix is `governance/rules/canon/605-worktrees.md`, which a target reads back at `.claude/rules/canon/canon/605-worktrees.md` once it has run `canon gov sync`.

## Tooling caveats

Tools that honor `.gitignore` by walking parent directories treat every file in a linked worktree as ignored once `.claude/worktrees/` is in the main repo's `.gitignore`. `cspell` is the concrete case in this repo. Bound its search with `gitignoreRoot: ["."]` in `cspell.json` so it stops at the config's own directory.

## Ports across sessions

Two sessions that auto-start the same stdio MCP server each spawn their own process, so only a server that binds a port needs coordination. Deriving the port from the worktree's own directory name needs no shared state, since the name is unique per tree and stable across restarts. A claim file needs a lock to be correct under two sessions starting at once.

## Related

- [Parallel features](../../docs/workflow/parallel-features.md) for merge order, rebasing siblings, cleanup, and which paths to serialize
- [Operating model](../../docs/workflow/operating-model.md) for the orchestrator and worker roles that run in these worktrees
- [Claude Code permissions](permissions.md) for the rule that blocks every subagent
- [Claude Code subagents](subagents.md) for in-session parallelism without worktrees
- [Zshrc aliases for Claude Code](../../docs/workflow/zshrc-aliases.md) for `clw` and friends to shorten worktree spawn
