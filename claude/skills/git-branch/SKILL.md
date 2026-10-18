---
name: git-branch
description: Generates and validates conventional branch names, creating the branch from main or master and renaming it anywhere else. Use for any branch naming, creating, or renaming, such as when asked to "name this branch" or "create the branch for this feature".
metadata:
  family: ship
---

# Git branch

Before generating a branch name, read:

- `${CLAUDE_SKILL_DIR}/references/branch.md`: format, types, length limit, and constraints

Follow it exactly.

Run `git branch --show-current` to pick the mode. On `main` or `master` the skill creates a branch, and anywhere else it renames the current one.

## Create mode

### Name

Take the name from the invocation. An argument ending in `.md` or resolving under `.canon/plans/` is a plan, and anything else is a branch name, since a name always carries a `<type>/` segment.

- For a plan, run `canon tasks plan-branch <plan> --json` and take the record's `branch`. The verb fixes the type at `feat`, so a plan never yields another type.
- When the verb refuses or the record carries `conforms: false`, stop and relay its reason. Never invent a name in its place.
- For a name, check it against `branch.md` for a known type, kebab-case with no underscore, and 50 characters at most.

### Context

Run these in parallel once the name is known:

- `git show-ref --verify --quiet "refs/heads/<name>" && echo "LOCAL_EXISTS" || echo "LOCAL_FREE"`
- `git ls-remote --exit-code --heads origin "<name>" 2>/dev/null; echo "REMOTE_EXIT=$?"`

Exit 0 on the remote read is a collision. Exit 2, or a repository with no `origin`, is no collision. The check reads the remote itself, never `origin/<name>`, which sees only the last fetch. The skill does not fetch.

### Guards

Each guard stops before any ref moves.

- If the invocation carries no plan and no name, stop: `❌ No plan or branch name to create from.`
- If the name breaks `branch.md`, stop and name the cap it broke: `❌ <name> breaks the branch standard: <cap>.`
- If the name exists locally, stop: `❌ Branch <name> already exists locally.`
- If the name exists on the remote, stop: `❌ Branch <name> already exists on origin.`

### Preview

Output the preview first.

- **Current:** <main_or_master>
- **Creating:** <name>
- **Length:** <count>/50
- **Source:** <plan | name>

After outputting the preview, execute the final command immediately. Claude Code's tool permission dialog is the confirmation gate. Do not wait for user input.

### Final command

The branch starts at the current tip, and uncommitted changes carry onto it. The skill stashes nothing.

```bash
git switch -c <name>
```

### After execution

Respond with exactly one line and add no other text:

`✅ Created: <name>`

## Rename mode

### Context

Run these commands in parallel to gather git context:

- `git branch --show-current 2>/dev/null || echo "NO_BRANCH"`
- `git rev-parse --verify "origin/$(git branch --show-current)" 2>/dev/null && echo "EXISTS" || echo "LOCAL_ONLY"`
- `git log main..HEAD --oneline 2>/dev/null || echo "NO_COMMITS"`

### Guards

A conforming name passes through, so a chained caller continues past it.

- If branch name already follows conventions, stop: `✅ Branch name already follows conventions.`
- If no commits and no args provided, stop: `❌ No commits or description to derive a branch name from.`

### Preview

Output the preview first.

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

### After execution

Respond with exactly one line and add no other text:

`✅ Renamed: <current> → <suggested>`
