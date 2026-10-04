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
3. Fallback: `git branch --merged main --format='%(refname:short)' 2>/dev/null | grep -qx "<branch>"` to detect linear-merge ancestry. On match, mark `merged (local)`. Otherwise `unmerged`. Match the name alone. Without `--format`, git decorates the current branch with `*` and every branch checked out in a linked worktree with `+`, which is the whole set being enumerated.

Determine dirtiness: `git -C <path> status --porcelain` non-empty means `dirty`.

Determine current: the row whose `path` equals `git rev-parse --show-toplevel`. Resolve the root rather than comparing `pwd`, which equals the worktree root only when the session sits at the top of it. A session in any subdirectory would match no row, and the current-worktree exclusion in `cleanup` would pass its own worktree into the remove set.

Determine provenance: a non-main row is `foreign` when its `path` does not start with `<MAIN_ROOT>/.claude/worktrees/`. That prefix is the folder `session-worktree` creates under, a convention of that skill rather than a fact this one owns. A tree an operator registered by hand anywhere else on disk reads as `foreign`. Step 1 has already marked the main row `main`, so it never reaches this test.

Determine occupancy: run `canon sessions list --json` once for the whole enumeration, never once per row. Resolve each enumerated row's `path` and each live session's `worktree` field with `realpath` before comparing, since a session registered from a second clone of this repository reports a path under that clone rather than under `MAIN_ROOT`, and a raw string compare would hold nothing back. A row is `occupied` when a resolved `worktree` from any live session equals its resolved `path`. A resolved session `worktree` outside `MAIN_ROOT` names a different checkout, so it clears no row here and marks none as occupied.

The roster is unreadable when the command exits non-zero, when its JSON carries a `reason` field instead of a populated `sessions` array, or when `sessions` is non-empty but no entry carries a `worktree` key at all, which is the shape an older binary prints and cannot be told apart from a roster answering that nothing is occupied. `list` leaves the Notes column silent on that failure rather than changing behavior beyond it. `cleanup` refuses instead, stated in its own section below.

## `list` mode

Print the enumeration as a table, then stop. `list` has no final command.

```plaintext
| #  | Path                               | Branch            | State    | PR     | Notes    |
| -- | ---------------------------------- | ----------------- | -------- | ------ | -------- |
```

Notes column shows the first that applies of `current`, `occupied`, `foreign`, `dirty`, or empty. Show paths relative to `MAIN_ROOT` (`.claude/worktrees/<name>`). A `foreign` row sits outside `MAIN_ROOT`, so print its path in full.

After the table, append a one-line hint:

- If any row is `merged` and clean and not current and not `foreign`: `Hint: /git-worktree cleanup to remove <count> merged worktrees.`
- Otherwise: `Hint: no worktrees ready for cleanup.`

## `cleanup` mode

If Enumeration marked the roster unreadable, stop: `❌ Session roster unreadable, so occupancy cannot be checked. Resolve the canon sessions list failure, then re-run cleanup.` Hold every non-main row rather than computing the remove set from the other five tests alone, since removing a tree a live session holds is the failure this skill exists to prevent and a sweep that removes nothing costs one re-run.

From the enumeration, include a worktree in the remove set when all hold:

- Not the main row.
- Not the current session's worktree.
- Not occupied by a live session.
- Not a `foreign` tree.
- State is `merged` or `merged (local)`.
- Working tree is clean.

Every other non-main row goes to the skip set with a one-word reason, the first that applies in this order: `current`, `occupied`, `foreign`, `dirty`, `open`, `closed`, `unmerged`. A `foreign` tree that is also dirty reports `foreign`, since `dirty` is a state the operator can clear and `foreign` is not. Leading with the transient reason invites a commit or stash that changes nothing, after which the row reports `foreign` and holds back anyway.

### Preview

```plaintext
**Removing:** <count>

| Path | Branch | PR |
| ---- | ------ | -- |

**Skipping:** <count>

| Path | Branch | Reason |
| ---- | ------ | ------ |
```

If the remove set is empty, stop with `❌ Nothing to remove. All linked worktrees are current, dirty, unmerged, or foreign.`

### Final command

After the preview, execute immediately. Claude Code's tool permission dialog is the confirmation gate. Do not wait for user input.

```bash
git -C <MAIN_ROOT> worktree remove <path1> \
  && git -C <MAIN_ROOT> branch -D <branch1> \
  && git -C <MAIN_ROOT> worktree remove <path2> \
  && git -C <MAIN_ROOT> branch -D <branch2> \
  && git -C <MAIN_ROOT> worktree prune
```

Chain one `worktree remove` + `branch -D` pair per row in the remove set, then a single `worktree prune` at the end.

## After execution

Respond with exactly one line:

- `list`: `✅ <n> worktrees listed`
- `cleanup`: `✅ Removed: <count> worktrees, <count> branches pruned`

Do not add any other text.
