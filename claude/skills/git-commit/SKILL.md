---
name: git-commit
description: Generates one conventional commit message from the staged changes and commits them exactly as staged, so a hunk-level selection survives. Use when asked to "commit this" or "commit the staged changes" and the staged set covers one concern, when asked to "amend the last commit" or "fold this into the last commit", or whenever the selection was staged hunk by hand. Do NOT use when the staged changes span several concerns and need separate commits. That is `git-stage`.
metadata:
  family: ship
---

# Git commit

Before generating a commit message, read:

- `${CLAUDE_SKILL_DIR}/references/commit.md`: format, types, scopes, and constraints
- `${CLAUDE_SKILL_DIR}/references/versioning.md`: phase label vs semver discipline

Follow them exactly.

An ask that says to amend, or to fold the change into the last commit, takes `## Amend` in place of the guard and final command below. Every other ask makes a new commit, since an amend rewrites history and is never inferred from a plain "commit this".

## Context

Run these commands in parallel to gather git context:

- `git diff --cached --name-status 2>/dev/null || echo "NO_STAGED_CHANGES"`
- `git diff --cached -- . ':(exclude)*.lock' ':(exclude)*-lock.json' 2>/dev/null || echo "NO_DIFF"`

## Guards

- If staged files output is `NO_STAGED_CHANGES`, stop and output:
  `❌ No staged changes. Stage files first with git add before committing.`

## Response format

### Preview

Output the preview first.

- **Files:** <if ≤3 list all, if >3 show first 3 + "+N more">
- **Message:** `<type>(<scope>): <subject>`
- **Length:** <count>/72

After outputting the preview, execute the final command immediately. Claude Code's tool permission dialog is the confirmation gate. Do not wait for user input.

### Final command

Run it as soon as the preview is out.

```bash
git commit -m "<type>(<scope>): <subject>"
```

## After execution

Respond with exactly one line and add no other text:

`✅ Committed: <type>(<scope>): <subject>`

## Amend

The amend folds the staged set into `HEAD`. It keeps the existing message unless the ask names a new one, per the amend rule in `commit.md`.

### Amend context

Run these in parallel, beside the two reads under `## Context`:

- `git log -1 --format='%H%n%h%n%an <%ae>%n%s%n%p' HEAD 2>/dev/null || echo "NO_HEAD"`
- `git config user.email`
- `git branch --show-current`

Read `canon pr head --json` beside them, for any open pull request on the branch.

- `git branch -r --contains HEAD 2>/dev/null`
- `git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null || echo "origin/main"`

The full sha on the first line is `<old-sha>`, the commit the amend replaces, and the branch read is `<branch>`. The trunk read names `<trunk>`, and a non-empty `--contains` read means `<old-sha>` is already on the remote.

### Amend guards

Run them in this order, stopping at the first that fires.

- `NO_HEAD`: stop with `❌ No commit to amend. Make the first commit without amending.`
- Nothing staged and no new message in the ask: stop with `❌ Nothing to amend. Stage changes or name a new message.` A new message with nothing staged is a reword, which the amend allows.
- More than one parent on the `%p` line: stop with `❌ HEAD is a merge commit. Amend a merge by hand.`
- The author email differs from `git config user.email`: stop with `❌ HEAD was written by <author>. Amend only your own commit, or make a new one.`, naming the author line
- A `canon pr head` record carrying `number`: stop with `❌ <branch> has open pull request #<number>. Make a new commit, since an amend rewrites what its review read.`
  - A refusal, such as no open pull request, lets the amend continue

### Refuse merged history

An amend of a commit every clone already holds rewrites shared history. Run `git merge-base --is-ancestor HEAD <trunk>`, and treat any exit but zero as a commit the trunk does not hold yet, which the amend may rewrite.

On exit zero, `HEAD` sits on the remote trunk, so the amend runs only in a repository with no merged pull request yet. That is a new project kept at one commit on its default branch, where nothing has arrived through a merge.

1. Read `gh pr list --state merged --limit 1 --json number --jq length`. A count above zero stops with `❌ <trunk> has merged pull requests, so HEAD is shared history. Make a new commit instead.`
2. When `gh` exits non-zero, as on a remote outside GitHub, read the local trunk instead. Either signal takes the same stop.
   - A merge commit, from `git rev-list --merges -1 <trunk>`
   - A subject ending in `(#<n>)`, from `git log --format=%s <trunk>`
3. Say which read cleared the amend when neither stops it, since the local read cannot see a rebase merge.

### Amend preview

Output the preview first, then run the command immediately. The permission dialog is the gate, as on a new commit.

- **Amends:** `<short sha> <subject>`
- **Files:** <as on a new commit, or `none, reword only`>
- **Message:** `<kept message>` or the new one
- **Length:** <count>/72

Keep the message with `git commit --amend --no-edit`, or replace it with `git commit --amend -m "<type>(<scope>): <subject>"`.

### Push after an amend

A commit whose old version is on the remote now differs from it, so a plain push is rejected.

- Run `git push --force-with-lease=refs/heads/<branch>:<old-sha> origin HEAD` only when the same ask said to push, and stop before it when `<branch>` is empty
- Name `<old-sha>` in the lease rather than typing it bare, since a bare lease trusts whatever the last fetch wrote and a fetch can move it onto a collaborator's commit
- Never name a plain `--force`. The named lease refuses unless the remote branch still sits on the commit this amend replaced.

Respond with exactly one line:

- Pushed: `✅ Amended and pushed with lease: <subject>`
- On the remote, not pushed: `✅ Amended: <subject>. The old commit is on the remote, so push with --force-with-lease=refs/heads/<branch>:<old-sha>.`
- Not on the remote: `✅ Amended: <subject>`, since a plain push carries it
