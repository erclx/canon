---
title: Rebase a stale branch
description: The stash-and-rebase sequence, the conflict resolution rules, the two recovery messages a hunk needing a decision takes, and the message it owes the controlling session
---

# Rebase a stale branch

Mechanics for Step 5 of `review-address` once either half of its staleness test fires, being `git merge-tree` exiting non-zero or `main` having changed a file the branch writes. A branch passing both skips this file entirely, which is the ordinary run.

## The sequence

Stash the fixes first when `git status --porcelain` reports anything, since a rebase refuses to run over a dirty tree, then rebase onto `origin/main` and restore them:

```bash
git stash push -u
git rebase origin/main
git stash pop
```

Pop only when the stash ran. On a clean tree, which is what a run whose findings were all conscious-accepts leaves behind, `git stash push` saves nothing and exits zero, so the pop restores an unrelated entry from an earlier session.

Never merge `main` into the branch. The repository squash-merges, so a merge commit here reads as noise on the pull request.

## Resolving a conflict

These rules apply to a hunk from the rebase and a hunk from the stash pop alike:

- Never take one side wholesale with `--ours` or `--theirs`. Both sides are valid content, so the drop is silent and passes every check.
- Never resolve a generated file by hand. A file the project check rebuilds, such as an `index.md` carrying no `auto: false`, takes either side to clear the conflict and gets its real content from the regen below.
- Where two branches wrote prose into one file, keep both sides and rewrite what the merge broke. A section that opens by counting what follows needs the count updated rather than the two versions concatenated.
- When a hunk needs a decision the tree does not carry, stop rather than guessing, and name where the branch was left. The two sources recover differently. A guess that compiles is the failure this stage would otherwise introduce, and either case reaches the operator as an ordinary finding on the next review pass.
  - A hunk raised by the rebase takes `git rebase --abort`, which restores the old base: `❌ Conflict needs a decision at <file>. Branch left on its old base.`
  - A hunk raised by the stash pop arrives after the rebase already landed, so no abort applies and the conflict stays in the tree: `❌ Conflict needs a decision at <file>. Branch rebased, fixes left conflicted in the tree.`

Both sides of every hunk sit in the conflict and `git log origin/main` names what landed, so the tree carries the context. Do not wait on the orchestrator for it.

The stop still owes a message. When the launch named a controlling session, send it the stop line through `canon:session-relay` before halting, adding the commit on `main` that wrote the other side of the hunk, per the worker channel the `role-worker` skill states. Nothing else surfaces the halt, since the next review pass that would read it as a finding never starts on a branch nobody pushed. With nobody named, print the two lines above and stop.

## After the rebase

Re-run the project check. It rebuilds the generated files and covers what the replayed commits broke, and step 6 commits the result alongside the fixes.
