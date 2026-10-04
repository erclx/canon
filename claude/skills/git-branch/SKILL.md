---
name: git-branch
description: Generates and validates conventional branch names. Use for any branch naming or renaming, such as when asked to "name this branch".
metadata:
  family: ship
---

# Git branch

Before generating a branch name, read:

- `${CLAUDE_SKILL_DIR}/../../standards/branch.md`: format, types, length limit, and constraints

Follow it exactly.

## Context

Run these commands in parallel to gather git context:

- `git branch --show-current 2>/dev/null || echo "NO_BRANCH"`
- `git rev-parse --verify "origin/$(git branch --show-current)" 2>/dev/null && echo "EXISTS" || echo "LOCAL_ONLY"`
- `git log main..HEAD --oneline 2>/dev/null || echo "NO_COMMITS"`

## Guards

- If already on main or master, stop: `❌ Cannot rename a protected branch.`
- If branch name already follows conventions, stop: `✅ Branch name already follows conventions.`
- If no commits and no args provided, stop: `❌ No commits or description to derive a branch name from.`

## Response format

### Preview

- **Current:** <current_branch>
- **Suggested:** <suggested_name>
- **Length:** <count>/50
- **Status:** <LOCAL_ONLY | EXISTS on remote>
- **Analysis:** <brief explanation of type choice>

If EXISTS on remote, warn and stop:

```plaintext
⚠️ Branch exists on remote. Rename manually via GitHub UI or gh CLI to avoid breaking open PRs.
```

After outputting the preview, execute the final command immediately. Claude Code's tool permission dialog is the confirmation gate. Do not wait for user input.

### Final command

Only output if LOCAL_ONLY:

```bash
git branch -m <current> <suggested>
```

## After execution

Respond with exactly one line:

`✅ Renamed: <current> → <suggested>`

Do not add any other text.
