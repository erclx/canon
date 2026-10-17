---
title: Stacked split commands and merge loop
description: The final commands git-split runs in stacked mode, basing each branch on the one before it, and the restack loop run after each merge
---

# Stacked split commands and merge loop

Applies to a `git-split` run whose preview reads `Mode: Stacked`, where the groups are ordered and each depends on the commits before it.

## Final commands

Base each branch on the previous one and cherry-pick only that group's commits, since the base branch already carries every prior commit.

```bash
# Rename current branch to reflect primary concern
git branch -m <current_branch> <new_name>

mkdir -p .canon/tmp/pr/split

# Group 1: based on main
git switch -c <branch-1> main && git cherry-pick <g1-sha> <g1-sha> \
  && git push -u origin <branch-1> \
  && (cat <<'BODY' > .canon/tmp/pr/split/<branch-1>.md
<body following pr.md template, written from the cherry-picked commits>
BODY
) && gh api -X POST 'repos/{owner}/{repo}/pulls' -f title="<title>" -f head=<branch-1> -f base=main -F body=@.canon/tmp/pr/split/<branch-1>.md --jq .html_url \
  && printf 'opened=true\n' \
  && rm .canon/tmp/pr/split/<branch-1>.md

# Group 2: based on <branch-1>, this group's commits only
git checkout -b <branch-2> && git cherry-pick <g2-sha> <g2-sha> \
  && git push -u origin <branch-2> \
  && (cat <<'BODY' > .canon/tmp/pr/split/<branch-2>.md
<body following pr.md template, written from the cherry-picked commits>
BODY
) && gh api -X POST 'repos/{owner}/{repo}/pulls' -f title="<title>" -f head=<branch-2> -f base=<branch-1> -F body=@.canon/tmp/pr/split/<branch-2>.md --jq .html_url \
  && printf 'opened=true\n' \
  && rm .canon/tmp/pr/split/<branch-2>.md

# Return to primary branch, push, and open its PR on the last group's branch
git checkout <new_name> && git push -u origin <new_name> \
  && (cat <<'BODY' > .canon/tmp/pr/split/<new_name>.md
<body following pr.md template, written from the primary's commits>
BODY
) && gh api -X POST 'repos/{owner}/{repo}/pulls' -f title="<title>" -f head=<new_name> -f base=<branch-2> -F body=@.canon/tmp/pr/split/<new_name>.md --jq .html_url \
  && printf 'opened=true\n' \
  && rm .canon/tmp/pr/split/<new_name>.md

# Clean up the body-file dir if all PRs succeeded (no-op when non-empty)
rmdir .canon/tmp/pr/split 2>/dev/null || true
```

## Stacked merge loop

When the user signals the previous stacked PR has merged, restack the next one.

1. Rebase and push, taking the own-commit-count from the original split table:

   ```bash
   git fetch origin main && git checkout <branch> && git rebase --onto origin/main HEAD~<own-commit-count> && git push --force-with-lease
   ```

2. Verify the base auto-retargeted to main with `gh api repos/{owner}/{repo}/pulls/<num> --jq .base.ref`. If not, run `gh api -X PATCH repos/{owner}/{repo}/pulls/<num> -f base=main --silent`.
3. Reply: `✅ <branch> rebased onto main. Ready for squash-merge.`

Both reads go through REST, which a cloud session's GitHub proxy serves where it refuses GraphQL.

### Edge cases

Two states change the loop.

- If this branch's commits modify a file added by an unmerged upstream PR, wait for that PR to merge before rebasing
- If a base-branch deletion orphaned the PR, recreate it with the final commands' create on `-f head=<branch> -f base=main` and a fresh body, then print `opened=true`
