---
description: Route tracked-file writes and shared session scratch correctly from a linked worktree
---

# Worktrees standards

## Entering a worktree

- Implementation work runs in a linked worktree. From the main worktree, enter one with `/session-worktree` before editing tracked files for a feature.

## Shared session scratch

- Shared session scratch (`.canon/plans/`, `.canon/review/`, `.canon/memory/`, `.canon/tasks/`) lives at the main worktree root, not inside a linked worktree. From a linked worktree, resolve these paths against the main root via `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`. Fall back to `pwd` if not a git repo.
- `.canon/tmp/` is mixed rather than main-root by default: it stays worktree-local per `055-scratch.md`, and a skill that resolves a write there at the main root instead states so in its own body.
- From a linked worktree, every `Edit` or `Write` to a tracked file (source, docs) must use a path starting with `pwd`.
- From a linked worktree, `Edit` and `Write` are refused for every main-root path, session scratch included. The refusal names session isolation and points at the worktree copy, which is a second gitignored file no later session reads, so never take that redirect.
- `Read` resolves against the main root normally from a linked worktree. A main-root write reaches it only through `Bash`, as one plain command rather than a compound one, which is refused for complexity.
- Route a main-root write by what it does to the file. Creating a whole file goes out as one plain `Bash` command carrying a heredoc. Changing a line inside a file that already exists goes through a command that resolves the main root in-process, because the shell route for that case is the stream editor this file bans.
- A background session that entered no worktree at all meets the identical refusal writing to the main root, since the guard gates on isolation rather than on sitting inside a linked worktree. A planner writing its plan file from no worktree takes the same heredoc route for that reason.
- The heredoc route costs nothing on `.canon/plans/` and `.canon/review/`, which no `PostToolUse` hook watches, and costs the index on `.canon/tasks/` and `.canon/memory/`, since a hook matching `Write|Edit|MultiEdit` never fires on `Bash`. Regenerate positionally: in-process where a verb such as `canon tasks archive` already calls it, elsewhere by an explicit `canon indexes regen` call.
