---
title: Sweep consumed receipts
description: How docs-fold Step 9 sweeps branch review reports whose branch is gone and fully decided memory receipts, and what it keeps and reports
---

# Sweep consumed receipts

Step 9 of `docs-fold`, reached in order on every run.

Sweep the review and memory receipts this session consumed. Resolve all paths at the main worktree root, not the current worktree, the way `session-worktree` does.

Every delete below is a plain `rm`, one per call, routed the way `session-worktree` states.

Plans are not swept here. A plan is settled by the merge rather than by an outcome this run marked, and `canon tasks archive` moves it with the task the `post-merge` hook archives. Sweeping it from this step read a closure Step 3 had written moments earlier and moved a plan the branch was still building from.

## Reviews

Leave the current branch's review receipt where it is. `auto-ship` Step 6 keeps minor findings in `.canon/review/branch-<slug>.md` and its closing block hands the reader that path, so deleting it here removes the file the chain that invoked this skill is still citing. Seven runs recorded that collision across two days before a sandbox fixture asserted the receipt and could pass only on a run the chain stopped early.

The body that writes a receipt owns its lifetime. This skill sweeps on behalf of whatever called it and has no way to read whether a file is still in use, where the chain that wrote this one cites it in its own output and knows. What reaps it is the branch sweep below, one branch later, once the branch it names is gone.

Sweep the branch reports this session never opened. List `.canon/review/branch-*.md`, run the slug transform in `${CLAUDE_SKILL_DIR}/../../standards/slug.md` over every name `git branch --format='%(refname:short)'` prints, and delete a report whose slug matches none of them. Take the names from that format rather than from `git branch --list`, which marks the current branch with `* ` and a branch checked out in another worktree with `+ `, so a transform reading the marked lines as written turns a live branch into a slug nothing matches and sweeps a report a sibling worktree is still working from. A branch report is read once, by the session addressing it, and the durable record of what a review found is the comment `review-pr` posts on the pull request, so a report outliving its branch is holding nothing. Skipping this leaves them accumulating for the life of the checkout, since a slug is unique per feature and no later branch ever looks for one.

What that removes is a local-only review on a branch deleted before it opened a pull request. `review-branch` says so where a reader meets the report, and the sweep runs anyway rather than keeping every report against the one case, since nothing else ever clears them.

Memory receipts sweep board-wide rather than by slug. Scan every `.canon/memory/review/memory-review-*.md`, not only the one matching this slug. `memory-review` writes its receipt after this skill has run in every ship chain, so a sweep keyed on the current slug looks for a file that does not exist yet, and no later branch looks for it either because a slug is unique per feature. Scanning the folder is what makes the sweep fire at all.

For each receipt, count the H2 items still pending. An item is pending when its H2 carries 📝, or when its H2 carries no status emoji and its `Decision:` slot holds nothing `memory-review` Apply would act on or skip, since a receipt written by hand or by an older binary may lack the marker, and Apply's parse leaves every other slot value undecided:

- No pending item: fold it per the collection rule in `${CLAUDE_SKILL_DIR}/../../standards/memory.md`, then delete the receipt.
- Any pending item: leave it and report the count. Pending items are decision state, and a branch shipping is not an operator deciding them.

That standard owns what a fold writes and which entry types take one. `memory-review` collects a receipt on the same rule, so neither body restates it.

Do not sweep `ux-audit-*.md` or `ux-measure-*.md` (standalone deliverables). Those sit at `.canon/review/` itself rather than under a producer folder, so the two globs above never reach them.

Output one line per file swept:

- `🧹 Deleted: <path>, branch gone` for a branch report whose branch no longer exists
- `🧹 Deleted: <path>, folded <n> skips` for a swept memory receipt
- `⏭ Kept: <path>, <n> items pending` for a memory receipt still holding decisions

If nothing qualifies, skip this step silently.
