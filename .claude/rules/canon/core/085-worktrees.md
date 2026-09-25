---
description: Enter a linked worktree for implementation, resolve shared session scratch at the main root, and route a refused main-root write through session-worktree
---

# Worktrees standards

## Entering a worktree

- Implementation work runs in a linked worktree. From the main worktree, enter one with `/session-worktree` before editing tracked files for a feature.

## Shared session scratch

- Shared session scratch (`.canon/plans/`, `.canon/review/`, `.canon/memory/`, `.canon/tasks/`) lives at the main worktree root, not inside a linked worktree. From a linked worktree, resolve these paths against the main root via `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`. Fall back to `pwd` if not a git repo.
- From a linked worktree, or from a background session that entered none, `Edit` and `Write` refuse a main-root path and redirect to a worktree copy no later session reads. Never take that redirect. Route the write the way the `session-worktree` skill states, and report it rather than proceeding silently when that skill does not resolve. It ships with the plugin and this rule ships with the CLI, so a project that installed governance alone does not have it.
