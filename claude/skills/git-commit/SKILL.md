---
name: git-commit
description: Generates one conventional commit message from the staged changes and commits them exactly as staged, so a hunk-level selection survives. Use when asked to "commit this" or "commit the staged changes" and the staged set covers one concern, or whenever the selection was staged hunk by hand. Do NOT use when the staged changes span several concerns and need separate commits. That is `git-stage`.
metadata:
  family: ship
---

# Git commit

Before generating a commit message, read:

- `${CLAUDE_SKILL_DIR}/../../standards/commit.md`: format, types, scopes, and constraints
- `${CLAUDE_SKILL_DIR}/../../standards/versioning.md`: phase label vs semver discipline

Follow them exactly.

## Context

Run these commands in parallel to gather git context:

- `git diff --cached --name-status 2>/dev/null || echo "NO_STAGED_CHANGES"`
- `git diff --cached -- . ':(exclude)*.lock' ':(exclude)*-lock.json' 2>/dev/null || echo "NO_DIFF"`

## Guards

- If staged files output is `NO_STAGED_CHANGES`, stop and output:
  `❌ No staged changes. Stage files first with git add before committing.`

## Response format

### Preview

- **Files:** <if ≤3 list all, if >3 show first 3 + "+N more">
- **Message:** `<type>(<scope>): <subject>`
- **Length:** <count>/72

After outputting the preview, execute the final command immediately. Claude Code's tool permission dialog is the confirmation gate. Do not wait for user input.

### Final command

```bash
git commit -m "<type>(<scope>): <subject>"
```

## After execution

Respond with exactly one line:

`✅ Committed: <type>(<scope>): <subject>`

Do not add any other text.
