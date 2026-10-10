---
title: Sweep consumed receipts
description: How context-fold Step 8 sweeps branch review reports whose branch is gone, and what it keeps and reports
---

# Sweep consumed receipts

Step 8 of `context-fold`, reached in order on every run.

Sweep the review receipts this session consumed. Resolve all paths at the main worktree root, not the current worktree, the way `session-worktree` does.

Every delete below is a plain `rm`, one per call, routed the way `session-worktree` states.

Plans are not swept here. A plan is settled by the merge rather than by an outcome this run marked, and `canon tasks archive` moves it with the task the `post-merge` hook archives. Sweeping it from this step read a closure Step 3 had written moments earlier and moved a plan the branch was still building from.

## Reviews

Leave the current branch's review receipt where it is. No skill writes one now, so one that exists is older and its branch is still live.

The body that writes a receipt owns its lifetime. This skill sweeps on behalf of whatever called it and has no way to read whether a file is still in use, where the chain that wrote this one cites it in its own output and knows. What reaps it is the branch sweep below, one branch later, once the branch it names is gone.

Sweep the branch reports this session never opened. List `.canon/review/branch-*.md`, run the slug transform in `${CLAUDE_SKILL_DIR}/../../standards/slug.md` over every name `git branch --format='%(refname:short)'` prints, and delete a report whose slug matches none of them. Take the names from that format rather than from `git branch --list`, which marks the current branch with `* ` and a branch checked out in another worktree with `+ `, so a transform reading the marked lines as written turns a live branch into a slug nothing matches and sweeps a report a sibling worktree is still working from. A branch report is read once, by the session addressing it, and the durable record of what a review found is the comment `review-pr` posts on the pull request, so a report outliving its branch is holding nothing. Skipping this leaves them accumulating for the life of the checkout, since a slug is unique per feature and no later branch ever looks for one.

What that removes is a local-only review on a branch deleted before it opened a pull request. The sweep runs anyway rather than keeping every report against the one case, since nothing else ever clears them.

Do not sweep `ux-audit-*.md` or `ux-measure-*.md` (standalone deliverables). Those sit at `.canon/review/` itself rather than under a producer folder, so the glob above never reaches them.

Output one line per file swept:

- `🧹 Deleted: <path>, branch gone` for a branch report whose branch no longer exists

If nothing qualifies, skip this step silently.
