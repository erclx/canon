---
name: git-followup
description: Ships a small self-review edit on the current PR branch by staging, committing, pushing, and syncing the open PR, replying on the PR when it carries review comments. Use when asked to "ship a followup", "push the PR fix", "followup", or "commit and push this small change". Do NOT use when there is no open PR for the branch (use git-ship instead).
---

# Git followup

Ship a small self-review edit on the current PR branch in one pass.

When invoked with `reply-owned`, a caller such as `review-address` posts
its own reply, so skip the comment in step 7. The push and body sync still run.

## Guards

- If `git branch --show-current` returns `main`, stop: `❌ On main. Switch to a PR branch first.`
- If `git status --porcelain` is empty, stop: `❌ No changes to ship.`
- If `gh pr view --json state -q '.state' 2>/dev/null` is not `OPEN`, stop: `❌ No open PR for this branch. Use git-ship to open one.`

A missing tracking ref is no longer a guard. An open pull request proves the branch reached the remote, and a branch created by worktree entry has been measured carrying an open pull request with no tracking ref, where the old guard reported that the branch still needed pushing. That message describes a state the branch is not in, so the run stopped on a diagnosis nobody could act on. Step 4 sets the ref instead.

## Sequence

1. Run `git status` to confirm the changes are intentional
2. Run `git add -A` to stage every change
3. Invoke `canon:git-commit` to generate one conventional commit from the staged diff
4. Push, in one of two cases.
   - When `git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null` is empty, the branch has an open pull request and no tracking ref, so run `git push -u origin HEAD` to send the commit and set the ref in one step.
   - Otherwise push to the tracking branch with `git push`, and when `git merge-base --is-ancestor @{u} HEAD` exits non-zero, a caller rewrote the branch and a plain push is rejected, so push with `--force-with-lease` instead.

   The lease is what stops the force from overwriting a commit this session never read. Run the ancestry test only where an upstream resolves, since it reads `@{u}`.

5. Post the evidence comparison, on every invocation including `reply-owned`, since this comment is not the reply step 8 owns. Run `canon pr evidence <number> --json`, resolving `<number>` from `gh pr view --json number`, and read `reason` on the record rather than the exit code.
   - `no-evidence`: nothing changed under an `evidence/` segment this push. Say nothing and move on.
   - `ok`: write `body` to `.canon/tmp/pr/evidence/body-<number>.md` at the main worktree root (resolved the way `session-worktree` does), then post the comment with `gh pr comment <number> --body-file <main-root>/.canon/tmp/pr/evidence/body-<number>.md` when the record carries no `commentId`, or edit the existing one in place with `gh api -X PATCH repos/{owner}/{repo}/issues/comments/<commentId> -F body=@<main-root>/.canon/tmp/pr/evidence/body-<number>.md` when it does. Clean up the tmp file only after the call reports success.
   - Any other reason is one of the mirrored git refusals (`gh-missing`, `gh-failed`, `no-base`, `unreadable-tree`, `unreadable-changes`). Report it and continue without stopping the chain.
6. Check for existing review comments: `gh api 'repos/{owner}/{repo}/pulls/<number>/comments' --jq 'length'`, resolving `<number>` from `gh pr view --json number`.
7. Sync the body and title on every invocation, before the routing below decides on the reply.
   - Run `gh pr view --json url,title,body` and update the body with `gh pr edit --body` when the new commit changes scope, and the title with `gh pr edit --title` when the scope shifted enough to make it inaccurate.
   - A fix commit answering a review changes what shipped exactly as much as an ordinary followup does, so the sync cannot wait on the invocation or the comment count below.
   - A body a person edited by hand between rounds gets no special handling: judge it against the tree the same way regardless of who wrote it last, since a hand-edit the fix commit has made stale is the exact drift this sync exists to close.
8. Route on the invocation and the comment count for the reply alone.
   - When invoked with `reply-owned`, skip this step: the caller posts its own reply.
   - Otherwise, if the count is above zero, the followup addresses review feedback: post a one-line summary of the fix with `gh pr comment --body`, first running the scan in `${CLAUDE_SKILL_DIR}/../../standards/publish.md` against it, since the hook does not see an inline comment body. The `pull_request` check the git-pr surface carries triggers on a push or an open rather than a plain edit, so neither this comment nor the title and body step 7 synced reaches it.
   - If it is zero, nothing further runs. The sync in step 7 already did this branch's job.

## After completion

Output one line:

```plaintext
✅ Followup shipped: <pr-url>
```
