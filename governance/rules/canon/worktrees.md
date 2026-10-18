---
description: Enter a linked worktree for implementation, resolve shared session scratch at the main root, and route a refused main-root write through session-worktree
---

# Worktrees standards

## Entering a worktree

- Implementation work runs in a linked worktree. From the main worktree, enter one with `/session-worktree` before editing tracked files for a feature.

## Shared session scratch

- Resolve shared session scratch (`.canon/plans/`, `.canon/review/`, `.canon/tasks/`) at the main worktree root, never inside a linked worktree.
- Read the main root from `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`, and fall back to `pwd` outside a git repo.
- Never take the worktree copy `Edit` and `Write` redirect a main-root path to, since no later session reads it. Revisit when Edit and Write stop redirecting a main-root path from a linked worktree.
- Route a main-root write from a linked worktree, or from a background session that entered none, the way the `session-worktree` skill states.
- Report it rather than proceeding silently when `session-worktree` does not resolve, as in a project that installed governance without the plugin.
