---
title: Worktree cleanup
description: Which enumerated worktrees git-worktree cleanup removes, the skip reasons and their order, the preview, and the final command
---

# Worktree cleanup

Applies to `git-worktree` in `cleanup` mode, after the enumeration has run and the roster read cleanly. The roster stop stays in the skill body.

## The remove set

Include a worktree when every test holds:

1. Not the main row.
2. Not the current session's worktree.
3. Not occupied by a live session.
4. Not a `foreign` tree.
5. State is `merged` or `merged (local)`.
6. Working tree is clean.

### The skip set

Every other non-main row goes to the skip set with a one-word reason, the first that applies in this order: `current`, `occupied`, `foreign`, `dirty`, `open`, `closed`, `unmerged`.

A `foreign` tree that is also dirty reports `foreign`, since the operator can clear `dirty` and cannot clear `foreign`. Leading with the transient reason invites a commit or stash that changes nothing.

## Preview

```plaintext
**Removing:** <count>

| Path | Branch | PR |
| ---- | ------ | -- |

**Skipping:** <count>

| Path | Branch | Reason |
| ---- | ------ | ------ |
```

If the remove set is empty, stop with `❌ Nothing to remove. All linked worktrees are current, dirty, unmerged, or foreign.`

## Final command

After the preview, execute immediately without waiting for user input, since Claude Code's tool permission dialog is the confirmation gate.

```bash
git -C <MAIN_ROOT> worktree remove <path1> \
  && git -C <MAIN_ROOT> branch -D <branch1> \
  && git -C <MAIN_ROOT> worktree remove <path2> \
  && git -C <MAIN_ROOT> branch -D <branch2> \
  && git -C <MAIN_ROOT> worktree prune
```

Chain one `worktree remove` + `branch -D` pair per row in the remove set, then a single `worktree prune` at the end.
