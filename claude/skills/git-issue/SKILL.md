---
name: git-issue
description: Format a bug or task from the current session into a GitHub issue and file it on the current repo via `gh issue create`. Use when asked to "file an issue", "open an issue", "log this bug", "raise an issue", or "track this as an issue". Do NOT use to report a toolkit defect from a target project (that is `canon-feedback-file`), or to open a pull request (that is `git-pr`).
---

# Git issue

Format an issue from session context following the issue standard, then file it on the current repository with `gh issue create`.

## Context

Read these in parallel:

- `${CLAUDE_SKILL_DIR}/references/issue.md`: issue title, labels, body sections, and banned phrases
- `${CLAUDE_SKILL_DIR}/../../standards/markdown.md`: banned words, punctuation, and formatting for all generated text
- The `write-human` skill: voice, rhythm, and sentence construction for all generated text

Then gather repo context in parallel:

- `git remote get-url origin 2>/dev/null || echo "NO_REMOTE"`
- `gh auth status >/dev/null 2>&1 && echo "AUTHED" || echo "NO_AUTH"`

## Guards

- If nothing in session context describes a concrete bug or task, stop: `❌ No issue in session context. Describe the bug or task, then re-invoke.`
- If `git remote get-url origin` returns `NO_REMOTE`, stop: `❌ No GitHub remote. gh issue create needs an origin.`
- If `gh auth status` returns `NO_AUTH`, stop: `❌ gh is not authenticated. Run gh auth login.`
- If the type is ambiguous between a bug and a task, ask one line before formatting.

## Response format

### Preview

- **Title:** `<type>: <subject>`
- **Label:** <bug or enhancement>
- **Analysis:** <one line on what the issue captures>

After outputting the preview, execute the final command immediately. Claude Code's tool permission dialog is the confirmation gate. Do not wait for user input.

### Pre-publish scan

Before running the final command, run the scan in `${CLAUDE_SKILL_DIR}/../../standards/publish.md` against the title and body. The title and body go straight to the remote with nothing checking them on the way, so this scan is the only gate. It covers the phase-label check as well as the characters, since both go to a reader who has no task board. It applies on top of the banned phrases in `${CLAUDE_SKILL_DIR}/references/issue.md`.

The `pull_request` check the git-pr surface carries reads a pull request's own title and body alone, so an issue reaches no check behind this scan either.

### Final command

Map a bug to `--label bug` and a task to `--label enhancement`.

```bash
mkdir -p .canon/tmp/issue
cat <<'BODY' > .canon/tmp/issue/body.md
<body following the issue.md sections>
BODY
gh issue create --title "<type>: <subject>" --label <bug or enhancement> --body-file .canon/tmp/issue/body.md
rm -rf .canon/tmp/issue
```

## After execution

Respond with exactly one line:

`✅ Issue: <url>`

Do not add any other text.
