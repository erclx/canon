---
title: Fan-in member exit and integrator merge
description: How auto-ship stops a fan-in member after its push and how an integrator merges the member branches before its own build, so a set of parallel batches ships as one pull request
---

# Fan-in

The session reads this file at one of two points in `auto-ship`. A member reads `## Member exit` after Step 4, and an integrator reads `## Integrator merge` at the opening of Step 2. When to fan in and how a plan declares its side are in `${CLAUDE_SKILL_DIR}/../plan-feature/references/batches.md`.

## Member exit

Step 3's verify and Step 4's test order have already run, so the branch is green and committed. The member ends here rather than at a pull request.

1. Push the branch with `git push -u origin <branch>`. The pre-push hook runs the project check, and a member that fails it stops the way Step 3 does.
2. Read the head with `git rev-parse HEAD` once the push returns.
3. Announce the batch done to the controlling session through `canon:session-relay`, carrying the branch, the head commit, the integrator the plan names, and any row this build turned up.
4. Stop. Run no UI checklist, no `git-ship`, and no draft mark.

The pushed branch is the done signal the integrator's gate reads, so push once, at the end, and never mid-build. The announcement carries no reach, since members of one set share files by design and the integrator's announcement carries the reach for the whole set.

A fix the integrator needs after this point lands on the integrator's branch, since a member has no pull request to fix it on.

## Integrator merge

The members are pushed before this run starts, since `canon tasks plan-answers` holds an integrator until every member branch is on origin. Confirm that before merging anything:

```bash
git fetch origin --quiet
canon tasks plan-answers <plan> --json
```

Stop on `launchable: false`, reporting each `open` entry, since a `Fan-in pending` entry names a member that has not pushed and a `Fan-in set` entry names a set whose sides disagree. Then merge each member in the order the `Fans in` bullet lists:

```bash
git merge --no-ff --no-edit origin/<member branch>
```

### Conflicts and the order

`--no-ff` keeps one merge commit per member, so `git log --first-parent` shows the reviewer one member at a time. Never squash or fast-forward a member in.

- Resolve each conflict by `## Resolving a conflict` in `${CLAUDE_SKILL_DIR}/../review-address/references/rebase-conflicts.md`
- Stop on a hunk needing a decision with `git merge --abort` in place of the rebase abort that file names
- Regenerate the indexes once, after the last merge, rather than resolving a generated file by hand at each one
- Run `git config rerere.enabled true` before the first merge, since a stale integrator rebases with `--rebase-merges` per the same file and that replays each merge without its recorded resolution

Continue Step 2 with the integrator plan's own `**Files to touch:**`, then the rest of the chain as an ordinary worker.

### What the pull request carries

Say in the pull request body that each member is one merge commit, and name the members on one line in `## Summary`, backticked, in merge order:

```markdown
Fan-in members: `feat/a`, `feat/b`, `feat/c`
```

The line names branches rather than plan stems, since the branch is what gets deleted. Nothing outside it is read, so a branch named in prose elsewhere in the body is never a candidate.

### After the merge

The post-merge hook runs `canon worktrees retire-members` for each merged pull request number, and the verb deletes each member's branch on origin, its worktree, and its local branch. No session runs a step.

No member opens a pull request, so neither head-branch deletion nor `canon worktrees reclaim` ever reads one as merged. The member line is what reaches them.

- A member half goes only when its tip is an ancestor of the integrator's merged head, so a commit added after the merge keeps that half
- A worktree a live session holds, or one with uncommitted work, stays with its local branch
- A line naming the trunk, the integrator's own branch, or a branch with an open pull request deletes nothing

Run the verb by hand for a merge the hook missed, reading the dry run first:

```bash
canon worktrees retire-members --pull-request <number> --dry-run
```
