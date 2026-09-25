---
name: git-stage
description: Groups staged files by concern and generates one conventional commit per group. Use when asked to "group these changes into commits", or when staged changes span multiple concerns and need to ship as separate commits. Do NOT use on a single-concern staged set. That is `git-commit`, which also preserves a hunk-level selection this skill's unstage and restage over whole files would widen.
---

# Git stage

Read these files in parallel:

- `${CLAUDE_SKILL_DIR}/../../standards/commit.md`: format, types, scopes, and constraints
- `${CLAUDE_SKILL_DIR}/../../standards/markdown.md`: punctuation and formatting for all generated text
- The `write-human` skill: voice, rhythm, and sentence construction for all generated text

## Context

Run these commands in parallel to gather git context:

- `git diff --cached --name-status 2>/dev/null || echo "NO_STAGED_FILES"`
- `git diff --cached -- . ':(exclude)*.lock' ':(exclude)*-lock.json' 2>/dev/null || echo "NO_DIFF"`

## Guards

- If staged files output is `NO_STAGED_FILES`, stop and output:
  `❌ No staged files. Stage files first with git add before committing.`

## Grouping rules

- Analyze the diff to understand what each file changes and why.
- Group files by shared concern. A group is a single commit.
- Files belong together when they implement or modify the same logical unit.
- A file that clearly stands alone is its own group.
- Order commits by dependency: commit dependencies before the files that import them.
- Prefix the full command sequence with `git restore --staged .` to unstage everything, then stage and commit each group in order.
- For `D` status files, use `git rm <file>`. For `A` or `M` files, use `git add <file>`.
- For `R<score>` status rows, `--name-status` emits three tab-separated fields: `R<score>\t<old>\t<new>`. Treat the pair as one file, keep both paths in the same group, and restage them together with `git add <old> <new>` so git detects the rename at commit time. Splitting the pair across groups produces an add-plus-delete pair instead of a rename.

## Response format

### Preview

**Staged files:** <total count>
**Proposed commits:** <group count>

| #   | Commit                       | Files       | Count |
| --- | ---------------------------- | ----------- | ----- |
| 1   | `<type>(<scope>): <subject>` | <filenames> | <n>   |
| 2   | `<type>(<scope>): <subject>` | <filenames> | <n>   |

**All <total> files accounted for.**

Count characters in each `<type>(<scope>): <subject>` line. Shorten any subject that exceeds 72 characters and update the table.

After outputting the preview, execute the final command immediately. Claude Code's tool permission dialog is the confirmation gate. Do not wait for user input.

### Final command

```bash
git restore --staged .
# Commit 1: <subject>
git add <file1> <file2> && git commit -m "<type>(<scope>): <subject>"
# Commit 2: <subject>
git rm <deleted1> && git add <file3> && git commit -m "<type>(<scope>): <subject>"
# Commit 3 (rename): <subject>
git add <old> <new> && git commit -m "<type>(<scope>): <subject>"
```

## After execution

Respond with exactly one line:

`✅ Committed: <n> commits`

Do not add any other text.
