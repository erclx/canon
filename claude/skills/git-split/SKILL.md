---
name: git-split
description: Splits a mixed-commit branch into focused branches off main using cherry-pick. Use when a branch has unrelated commits, asking "split this branch", or needing to separate concerns into reviewable PRs.
---

# Git split

Before proposing a split, read in parallel:

- `${CLAUDE_SKILL_DIR}/../../standards/branch.md`: format, types, length limit, and constraints
- `${CLAUDE_SKILL_DIR}/../../standards/pr.md`: PR title format, body sections, and content rules

Follow both exactly.

## Context

Run these commands in parallel to gather git context:

- `git status --porcelain 2>/dev/null || echo "NO_STATUS"`
- `git branch --show-current 2>/dev/null || echo "NO_BRANCH"`
- `git log main..HEAD --oneline --no-decorate --stat 2>/dev/null || echo "NO_COMMITS"`

## Guards

- If working tree is dirty (non-empty `git status --porcelain`), stop:
  `❌ Working tree is dirty. Commit or stash changes before splitting.`
- If current branch is `main` or `master`, stop:
  `❌ Already on main. Nothing to split.`
- If no commits ahead of main, stop:
  `❌ No commits ahead of main. Nothing to split.`

## Grouping rules

- Group commits by concern using both commit messages and file paths.
- Prefer fewer branches: combine related commits into one branch.
- Only split into separate branches when concerns are clearly independent.
- Identify the primary concern of the current branch. Rename it using `git branch -m` if the current name does not already match. Skip the rename if it already matches. Secondary concerns are extracted as new focused branches via cherry-pick.
- If no single concern dominates (dumping-ground branch with no clear primary), split all commits into new focused branches and add `git branch -d <current>` to delete the original.
- Propose one new branch per secondary concern following branch.md format.
- Classify groups as independent or stacked before generating commands.
- Independent groups: each group's commits apply to `main` without the others. Base every branch on `main`.
- Stacked groups: groups are ordered and each depends on the commits before it. Base each branch on the previous group's branch. Cherry-pick only that group's commits onto it. The base branch already carries all prior commits.

## Response format

### Preview

**Current branch:** <branch_name>
**Total commits ahead of main:** <count>
**Mode:** Independent | Stacked

| Group     | Branch               | Base           | Commits | Count |
| --------- | -------------------- | -------------- | ------- | ----- |
| <concern> | <type>/<description> | main           | <shas>  | <n>   |
| <concern> | <type>/<description> | <prior-branch> | <shas>  | <n>   |

**All <total> commits accounted for.**

- For the primary concern (the current branch), show `<current_branch> → <new_name>` only when renaming. Show `<current_branch>` alone if the existing name already matches the concern.
- For stacked mode, list rows in merge order: branches based on `main` first, then each layer above. For independent mode, list the primary concern first.

If Mode is Stacked, append this line to the preview:

`🔁 Sequential squash-merge loop. Squash-merge each PR bottom-up with --delete-branch. After each merge, signal me so I can restack the next branch onto main before you merge it.`

If Mode is Independent, append this line to the preview:

`🔁 Squash-merge secondaries first, primary last. The primary keeps every cherry-picked commit, so merging it first lands every secondary's content on main and leaves the secondary PRs empty after rebase.`

After outputting the preview, execute the final commands immediately. Claude Code's tool permission dialog is the confirmation gate. Do not wait for user input.

Before running them, run the scan in `${CLAUDE_SKILL_DIR}/../../standards/publish.md` against every title and body. Each body stages under `.canon/tmp/` and leaves through `gh`, so the hook sees neither and this scan is the only gate. Each resulting branch reaches the `pull_request` check the git-pr surface carries once its own pull request opens, but not before, so this scan is what catches a leak ahead of that.

### Final commands

For independent mode, base every branch on `main`:

```bash
# Rename current branch to reflect primary concern
git branch -m <current_branch> <new_name>

# Create, cherry-pick, push, and open PR for each secondary branch
mkdir -p .canon/tmp/pr/split
git switch -c <branch> main && git cherry-pick <sha> <sha> \
  && git push -u origin <branch> \
  && (cat <<'BODY' > .canon/tmp/pr/split/<branch>.md
<body following pr.md template, written from the cherry-picked commits>
BODY
) && gh pr create --title "<title>" --body-file .canon/tmp/pr/split/<branch>.md \
  && rm .canon/tmp/pr/split/<branch>.md

# Return to primary branch, push, and open its PR
git checkout <new_name> && git push -u origin <new_name> \
  && (cat <<'BODY' > .canon/tmp/pr/split/<new_name>.md
<body following pr.md template, written from the primary's commits>
BODY
) && gh pr create --title "<title>" --body-file .canon/tmp/pr/split/<new_name>.md \
  && rm .canon/tmp/pr/split/<new_name>.md

# Clean up the body-file dir if all PRs succeeded (no-op when non-empty)
rmdir .canon/tmp/pr/split 2>/dev/null || true
```

For stacked mode, base each branch on the previous and cherry-pick only that group's commits:

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
) && gh pr create --title "<title>" --body-file .canon/tmp/pr/split/<branch-1>.md \
  && rm .canon/tmp/pr/split/<branch-1>.md

# Group 2: based on <branch-1>, this group's commits only
git checkout -b <branch-2> && git cherry-pick <g2-sha> <g2-sha> \
  && git push -u origin <branch-2> \
  && (cat <<'BODY' > .canon/tmp/pr/split/<branch-2>.md
<body following pr.md template, written from the cherry-picked commits>
BODY
) && gh pr create --title "<title>" --body-file .canon/tmp/pr/split/<branch-2>.md \
  && rm .canon/tmp/pr/split/<branch-2>.md

# Return to primary branch, push, and open its PR
git checkout <new_name> && git push -u origin <new_name> \
  && (cat <<'BODY' > .canon/tmp/pr/split/<new_name>.md
<body following pr.md template, written from the primary's commits>
BODY
) && gh pr create --title "<title>" --body-file .canon/tmp/pr/split/<new_name>.md \
  && rm .canon/tmp/pr/split/<new_name>.md

# Clean up the body-file dir if all PRs succeeded (no-op when non-empty)
rmdir .canon/tmp/pr/split 2>/dev/null || true
```

## After execution

Respond with exactly one line:

`✅ Renamed: <old> → <new> | PRs: <primary-url>, <url1>, <url2>`

Do not add any other text.

## Stacked merge loop

When the user signals the previous stacked PR has merged, restack the next one.

1. Rebase and push. The own-commit-count comes from the original split table.
   `git fetch origin main && git checkout <branch> && git rebase --onto origin/main HEAD~<own-commit-count> && git push --force-with-lease`
2. Verify the PR's base auto-retargeted to main with `gh pr view <num> --json baseRefName`. If not, `gh pr edit <num> --base main`.
3. Reply: `✅ <branch> rebased onto main. Ready for squash-merge.`

Edge cases:

- If this branch's commits modify a file added by an unmerged upstream PR, wait for that PR to merge before rebasing.
- If the PR was orphaned by base-branch deletion, recreate it with `gh pr create --base main --head <branch>` and a regenerated body.
