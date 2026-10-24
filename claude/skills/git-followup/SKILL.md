---
name: git-followup
description: Ships a small self-review edit on the current PR branch by staging, committing, pushing, and syncing the open PR, replying on the PR when it carries review comments. A clean tree with unpushed commits skips the staging and commit. Use when asked to "ship a followup", "push the PR fix", "followup", or "commit and push this small change". Do NOT use when there is no open PR for the branch (use git-ship instead).
metadata:
  family: after-pr
---

# Git followup

Ship a small self-review edit on the current PR branch in one pass.

When invoked with `reply-owned`, a caller such as `review-address` posts
its own reply, so skip the comment in step 7. The push and body sync still run.

## Guards

- If `git branch --show-current` returns `main`, stop: `❌ On main. Switch to a PR branch first.`
- If `git branch --show-current` is empty, stop: `❌ Detached HEAD. Checkout the PR branch first.` This runs ahead of the next guard, which reads `@{u}`.
- If `git status --porcelain` is empty and no commit is unpushed, stop: `❌ No changes to ship.`
  - A commit is unpushed when `git rev-list @{u}..HEAD` lists one
  - Every commit is unpushed when `@{u}` does not resolve
- Resolve `<number>` once, here, through `canon pr head --json`, reading the record's `number`. Every later step names this `<number>` rather than resolving it again.
- A record refusing with `ambiguous-pull` stops: `❌ Two open PRs on this branch. Name the one to update.`

### Fallback lookup

When no record comes back, or it carries no `number`, read the open pull requests on the branch over REST instead. The branch is encoded so a `/` in its name reaches the query as `%2F`:

```bash
gh api "repos/{owner}/{repo}/pulls?head={owner}:$(git branch --show-current | jq -Rr @uri)&state=open" --jq '.[].number'
```

- Nothing printed stops: `❌ No open PR for this branch. Use git-ship to open one.`
- More than one number takes the `ambiguous-pull` stop rather than the first, since two open pull requests on one head leave nothing to say which one this push updates

### REST and the tracking ref

Every read and write in this skill runs on REST, since the `gh pr` subcommands run on GraphQL and a cloud session's GitHub proxy refuses it. A cloud worker reaches this skill through `review-address`, so one GraphQL call breaks that whole leg.

A missing tracking ref is not a guard, since an open pull request proves the branch reached the remote. A branch created by worktree entry carries an open pull request with no tracking ref, so step 4 sets the ref instead.

## Sequence

Steps 1 to 3 run only when the tree is dirty. A clean tree carrying unpushed commits already holds its commits, so it starts at step 4.

1. Run `git status` to confirm the changes are intentional
2. Run `git add -A` to stage every change
3. Invoke `canon:git-commit` to generate one conventional commit from the staged diff
4. Push, in one of two cases.
   - When `git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null` is empty, no ref tracks the branch, so run `git push -u origin HEAD` to push and set the ref in one step.
   - Otherwise run `git push`, and when `git merge-base --is-ancestor @{u} HEAD` exits non-zero, a caller rewrote the branch, so use `--force-with-lease`, since a plain push is rejected.

   The lease is what stops the force from overwriting a commit this session never read. Run the ancestry test only where an upstream resolves, since it reads `@{u}`.

5. Invoke `canon:pr-evidence` with `<number>` on every invocation, `reply-owned` included, since it is not step 8's reply.
   - It edits the marked comment in place, carries the checklist forward, and mints the preview only when the thread still owes one
   - Report it rather than proceeding silently when the skill does not resolve
   - Then read `canon pr evidence <number> --check --json` once, branching on `reason` and `owed` rather than the exit
   - Report anything but `settled` and continue, since a refused deploy would otherwise loop. A binary lacking `--check` reports the thread unread rather than settled.

6. Check for existing review comments: `gh api 'repos/{owner}/{repo}/pulls/<number>/comments' --jq 'length'`.
7. Sync the body and title on every invocation, before the routing below decides on the reply.
   - Read the live title and body with `gh api repos/{owner}/{repo}/pulls/<number> --jq '{html_url, title, body}'`
   - Update the body with `gh api -X PATCH repos/{owner}/{repo}/pulls/<number> -F body=@<file> --silent` when the new commit changes scope, writing the new body to `<file>` first
   - Update the title with `gh api -X PATCH repos/{owner}/{repo}/pulls/<number> -f title="<title>" --silent` when the scope shifted enough to make it inaccurate
   - A fix commit answering a review changes what shipped exactly as much as an ordinary followup does, so the sync cannot wait on the invocation or the comment count below.
   - Judge a body a person edited by hand against the tree like any other, since a hand-edit the fix commit made stale is the drift this sync closes.
   - Carry a `UI pass` line marked `<!-- pr-ui-pass -->` into any rewritten body unchanged, since `canon pr tick` owns it and a dropped marker defeats the reset on a new head.
   - Carry a `Fan-in members:` line into any rewritten body unchanged, since the post-merge hook reads it to delete the members and a dropped line deletes nothing and says nothing.
8. Route on the invocation and the comment count for the reply alone.
   - When invoked with `reply-owned`, skip this step: the caller posts its own reply.
   - Otherwise, if the count is above zero, the followup addresses review feedback, so post the summary below.
   - If it is zero, nothing further runs. The sync in step 7 already did this branch's job.

### Posting the step 8 reply

The body goes through a file, since a hook on `Bash` refuses an inline `-f body=` value and runs `canon labels scan` on the file before it allows the post.

- Write a one-line summary of the fix to `.canon/tmp/pr/followup/summary-<number>.md` in its own call
- Run `canon labels scan --body-file .canon/tmp/pr/followup/summary-<number>.md` against it, which applies the rule in `${CLAUDE_SKILL_DIR}/../git-pr/references/publish.md`
- Post it with `gh api -X POST repos/{owner}/{repo}/issues/<number>/comments -F body=@.canon/tmp/pr/followup/summary-<number>.md --silent`
- The `pull_request` check the git-pr surface carries triggers on a push or an open rather than a plain edit, so neither this comment nor the step 7 sync reaches it

## After completion

Output one line:

```plaintext
✅ Followup shipped: <pr-url>
```

Take `<pr-url>` off the `html_url` step 7 read.
