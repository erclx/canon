---
title: Sweep consumed receipts
description: How task-complete's marking step sweeps branch review reports whose branch is gone, and what it keeps and reports
---

# Sweep consumed receipts

Step 4 of `task-complete`'s Mark mode, reached in order on every marking run. Sweep the review receipts a shipped branch left behind.

- Resolve all paths at the main worktree root, not the current worktree, the way `session-worktree` does
- Every delete is a plain `rm`, one per call, routed the way `session-worktree` states

Plans are not swept here. A merge settles a plan, and `canon tasks archive` moves it with the task the `post-merge` hook archives, so sweeping it here would move a plan the branch is still building from.

## Reviews

Leave the current branch's review receipt where it is. No skill writes one now, so one that exists is older and its branch is still live.

The body that writes a receipt owns its lifetime. This skill cannot read whether a file is still in use, so the branch sweep below reaps it one branch later, once its branch is gone.

### The branch sweep

Sweep the branch reports this session never opened, deleting each whose slug matches no live branch.

1. List `.canon/review/branch-*.md`.
2. Run the slug transform in `${CLAUDE_SKILL_DIR}/../git-branch/references/slug.md` over every name `git branch --format='%(refname:short)'` prints.
3. Delete a report whose slug matches none of them.

Take the names from that format rather than `git branch --list`, which marks the current branch with `* ` and one checked out elsewhere with `+ `. Reading those marks as written turns a live branch into a slug nothing matches and sweeps a report a sibling worktree still uses.

### Why sweep at all

A branch report is read once, by the session addressing it. The durable record is the comment `review-pr` posts on the pull request, so a report outliving its branch holds nothing.

- Skipping the sweep leaves reports piling up for the life of the checkout, since a slug is unique per feature and no later branch looks for one
- The sweep also removes a local-only review on a branch deleted before it opened a pull request. It runs anyway, since nothing else clears them.

### What stays

Do not sweep `ui-audit-*.md` or `ui-measure-*.md`, which are standalone deliverables. They sit at `.canon/review/` itself rather than under a producer folder, so the glob never reaches them.

Output one line per file swept:

- `🧹 Deleted: <path>, branch gone` for a branch report whose branch no longer exists

If nothing qualifies, skip this step silently.
