---
name: git-split
description: Splits a mixed-commit branch into focused branches off main using cherry-pick. Use when a branch has unrelated commits, asking "split this branch", or needing to separate concerns into reviewable PRs.
metadata:
  family: after-pr
---

# Git split

Before proposing a split, read in parallel:

- `${CLAUDE_SKILL_DIR}/../git-branch/references/branch.md`: format, types, length limit, and constraints
- `${CLAUDE_SKILL_DIR}/../git-pr/references/pr.md`: PR title format, body sections, and content rules

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

### Primary concern

The current branch keeps its primary concern, and each secondary concern leaves as a new focused branch via cherry-pick.

- Rename the current branch with `git branch -m` when its name does not match the primary concern, and skip the rename when it does
- If no single concern dominates, as on a dumping-ground branch, split every commit into new branches and add `git branch -d <current>`
- Propose one new branch per secondary concern following branch.md format.

### Independent and stacked

Classify the groups before generating commands, since the mode decides each branch's base.

- Independent groups: each group's commits apply to `main` without the others. Base every branch on `main`.
- Stacked groups: groups are ordered and each depends on the commits before it. Base each branch on the previous group's branch and cherry-pick only that group's commits.

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

- For the primary concern, show `<current_branch> → <new_name>` only when renaming, and `<current_branch>` alone otherwise
- For stacked mode, list rows in merge order: branches based on `main` first, then each layer above. For independent mode, list the primary concern first.

### Merge order line

Append the line for the run's mode to the preview.

Stacked mode appends this line:

```plaintext
🔁 Sequential squash-merge loop. Squash-merge each PR bottom-up with --delete-branch. After each merge, signal me so I can restack the next branch onto main before you merge it.
```

Independent mode appends this line:

```plaintext
🔁 Squash-merge secondaries first, primary last. The primary keeps every cherry-picked commit, so merging it first lands every secondary's content on main and leaves the secondary PRs empty after rebase.
```

After outputting the preview, execute the final commands immediately. Claude Code's tool permission dialog is the confirmation gate. Do not wait for user input.

### Pre-publish scan

Before running them, run the scan in `${CLAUDE_SKILL_DIR}/../git-pr/references/publish.md` against every title and body. Each body stages under `.canon/tmp/` and leaves through `gh`, so the hook sees neither.

Each branch reaches the `pull_request` check only once its own pull request opens, so this scan is what catches a leak ahead of that.

### Final commands

Read the command block for the run's mode on reaching this step, and skip the other.

- Independent mode: `${CLAUDE_SKILL_DIR}/references/independent.md`
- Stacked mode: `${CLAUDE_SKILL_DIR}/references/stacked.md`

Every pull request opens through the REST pulls endpoint rather than the `gh pr` create subcommand, which runs on GraphQL and fails where a cloud session's GitHub proxy refuses it. The endpoint requires `base`, so each call names its layer's branch, and `-F` reads the body file where `-f` would post the path.

A create the endpoint refuses, such as one for a head with an open pull request, exits non-zero and stops the chain before `opened=true` prints and the body file is removed. A pull request creation log counts openings off `opened=true`, since the REST call prints a URL and never names itself.

## After execution

Respond with exactly one line and add no other text, reading each URL off the line its create printed through `--jq .html_url`:

`✅ Renamed: <old> → <new> | PRs: <primary-url>, <url1>, <url2>`

## Stacked merge loop

When the user signals the previous stacked PR has merged, restack the next one. Read `${CLAUDE_SKILL_DIR}/references/stacked.md` from its `## Stacked merge loop` section for the rebase, the retarget, the reply, and the two edge cases. An independent split skips it.
