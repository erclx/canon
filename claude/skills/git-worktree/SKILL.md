---
name: git-worktree
description: Lists linked worktrees with PR state and cleans up merged ones. Use when asked to "list worktrees", "clean up worktrees", or after shipping a PR to reclaim slots. Do NOT use to enter a worktree from scratch (use `session-worktree`).
metadata:
  family: after-pr
---

# Git worktree

List linked worktrees with their PR state and remove the merged ones. For entry, use `session-worktree`.

## Shipping order

- Merge the branch with the smallest shared-file footprint first. A branch touching `CLAUDE.md`, a Claude context entry, or a regenerated `index.md` merges last.
- Rebase each sibling worktree on `origin/main` after a PR merges and before the next one merges. Never merge a stale branch.
- Run `cleanup` once a PR merges, so the worktree and its local branch go together

## Mode selection

Pick exactly one mode from the user's request:

- `list`: show every worktree with its branch, PR state, and dirtiness ("list worktrees", "what worktrees do I have")
- `cleanup`: remove worktrees whose branches are merged, then prune local branches ("clean up worktrees", "reclaim worktree slots")

## Context

Run in parallel:

- `git rev-parse --git-dir 2>/dev/null || echo "NO_REPO"`
- `git rev-parse --git-common-dir 2>/dev/null || echo "NO_REPO"`
- `git worktree list --porcelain 2>/dev/null || echo "NO_REPO"`
- `git fetch --prune origin 2>/dev/null || echo "NO_REMOTE"`

Resolve `MAIN_ROOT` from the first `worktree` line of `git worktree list --porcelain`.

## Guards

- If either `git-dir` command returned `NO_REPO`, stop: `❌ Not a git repository.`

## Enumeration (list and cleanup)

Parse `git worktree list --porcelain` into rows. Each row has `path`, `branch`, `head`. Skip the `bare` row if present.

For each row, determine merge state of its branch:

1. Skip the main-root row. Mark it `main` with no PR lookup.
2. Try `gh pr view <branch> --json state,number,url 2>/dev/null`:
   - `MERGED`: state is `merged`, record PR number and URL.
   - `OPEN`: state is `open`, record PR number and URL.
   - `CLOSED`: state is `closed` (not merged), record PR number.
   - Command fails or returns no PR: fall through.
3. Fallback: `git branch --merged main --format='%(refname:short)' 2>/dev/null | grep -qx "<branch>"`. On match, mark `merged (local)`, otherwise `unmerged`.

Match the name alone in the fallback. Without `--format`, git decorates the current branch with `*` and every branch checked out in a linked worktree with `+`, which is the whole set being enumerated.

### Dirty, current, and foreign

Three more marks come from the row's own path.

| Mark      | Test                                                                             |
| --------- | -------------------------------------------------------------------------------- |
| `dirty`   | `git -C <path> status --porcelain` is non-empty                                  |
| current   | `path` equals `git rev-parse --show-toplevel`                                    |
| `foreign` | A non-main row whose `path` does not start with `<MAIN_ROOT>/.claude/worktrees/` |

Resolve the root rather than comparing `pwd`, which equals it only at the top of the worktree. A session in a subdirectory would match no row, and `cleanup` would pass its own worktree into the remove set.

The `foreign` prefix is the folder `session-worktree` creates under, a convention of that skill rather than a fact this one owns. A tree an operator registered by hand anywhere else reads as `foreign`, and the main row never reaches this test.

### Occupancy

Run `canon sessions list --json` once for the whole enumeration, never once per row. A row is `occupied` when a live session's `worktree` equals its `path`.

- Resolve both sides with `realpath` before comparing, since a session from a second clone reports a path under that clone and a raw compare would hold nothing back
- A resolved session `worktree` outside `MAIN_ROOT` names a different checkout, so it marks no row occupied

The roster is unreadable when the command exits non-zero, when its JSON carries a `reason` instead of a populated `sessions` array, or when `sessions` is non-empty and no entry carries a `worktree` key. An older binary prints that last shape, which cannot be told apart from nothing occupied.

## `list` mode

Print the enumeration as a table, then stop. `list` has no final command.

```plaintext
| #  | Path                               | Branch            | State    | PR     | Notes    |
| -- | ---------------------------------- | ----------------- | -------- | ------ | -------- |
```

Notes column shows the first that applies of `current`, `occupied`, `foreign`, `dirty`, or empty. Show paths relative to `MAIN_ROOT` (`.claude/worktrees/<name>`), and a `foreign` row's path in full. An unreadable roster leaves the Notes column silent and changes nothing else.

After the table, append a one-line hint:

- If any row is `merged` and clean and not current and not `foreign`: `Hint: /git-worktree cleanup to remove <count> merged worktrees.`
- Otherwise: `Hint: no worktrees ready for cleanup.`

## `cleanup` mode

If Enumeration marked the roster unreadable, stop: `❌ Session roster unreadable, so occupancy cannot be checked. Resolve the canon sessions list failure, then re-run cleanup.`

Hold every non-main row rather than computing the remove set from the other tests, since removing a tree a live session holds is the failure this skill exists to prevent, and a sweep that removes nothing costs one re-run.

### Remove set and final command

Read `${CLAUDE_SKILL_DIR}/references/cleanup.md` for the remove set, the skip reasons and their order, the preview, and the final command. `list` mode skips it.

## After execution

Respond with exactly one line and add no other text:

- `list`: `✅ <n> worktrees listed`
- `cleanup`: `✅ Removed: <count> worktrees, <count> branches pruned`
