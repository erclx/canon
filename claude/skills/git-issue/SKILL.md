---
name: git-issue
description: Format a bug or task from the current session into a GitHub issue and file it on the current repo via `gh issue create`. Use when asked to "file an issue", "open an issue", "log this bug", "raise an issue", or "track this as an issue". Do NOT use to report a toolkit defect from a target project (that is `canon-feedback`), or to open a pull request (that is `git-pr`).
metadata:
  family: after-pr
---

# Git issue

Format an issue from session context following the issue standard, then file it on the current repository with `gh issue create`.

## Context

Read these in parallel:

- `${CLAUDE_SKILL_DIR}/references/issue.md`: issue title, labels, body sections, and banned phrases
- `${CLAUDE_SKILL_DIR}/../markdown-craft/references/markdown.md`: punctuation and formatting for all generated text
- The `write-human` skill: voice, rhythm, and sentence construction for all generated text

Then gather repo context in parallel:

- `git remote get-url origin 2>/dev/null || echo "NO_REMOTE"`
- `gh auth status >/dev/null 2>&1 && echo "AUTHED" || echo "NO_AUTH"`

## Guards

- If nothing in session context describes a concrete bug or task, stop: `❌ No issue in session context. Describe the bug or task, then re-invoke.`
- If `git remote get-url origin` returns `NO_REMOTE`, stop: `❌ No GitHub remote. gh issue create needs an origin.`
- If `gh auth status` returns `NO_AUTH`, stop: `❌ gh is not authenticated. Run gh auth login.`
- If the type is ambiguous between a bug and a task, ask one line before formatting, after the duplicate question below.

## Duplicate check

Search the open issues before composing anything, since a duplicate costs the repository's triage a second item and a second answer.

```bash
gh issue list --state open --search "<keywords> in:title,body" --limit 5 --json number,title,url
```

- Take the keywords from the defect's distinctive terms, such as a command, a path, or an error string, never a common word alone
- Keep a candidate only when it describes the same defect, reading its body with `gh issue view <NNN> --json body` when the title leaves it open
- With none kept, go to the preview and file a new issue
- With one or more kept, ask once whether to add the findings to one of them as a comment or file a new issue, naming each by number and title
- With no one to answer, as in a headless run, file a new issue and name each kept candidate in the result

### Comment on the match

On a yes for an issue, write the comment in the `### Follow-up` shape `${CLAUDE_SKILL_DIR}/references/issue.md` gives, run the pre-publish scan below over it, then post it in place of the final command. Post nothing on any issue the answer did not name.

```bash
mkdir -p .canon/tmp/issue
cat <<'BODY' > .canon/tmp/issue/comment.md
<comment following the Follow-up section>
BODY
gh api -X POST 'repos/{owner}/{repo}/issues/<NNN>/comments' -F body=@.canon/tmp/issue/comment.md --jq .html_url
rm -rf .canon/tmp/issue
```

## Response format

### Preview

Output the preview first.

- **Title:** `<type>: <subject>`
- **Label:** <bug or enhancement>
- **Analysis:** <one line on what the issue captures>

After outputting the preview, execute the final command immediately. Claude Code's tool permission dialog is the confirmation gate. Do not wait for user input.

### Pre-publish scan

Before running the final command, run the scan in `${CLAUDE_SKILL_DIR}/../git-pr/references/publish.md` against the title and body, on top of the banned phrases in `${CLAUDE_SKILL_DIR}/references/issue.md`.

- The title and body go straight to the remote, and the `pull_request` check reads a pull request alone, so this scan is the only gate
- It covers the phase-label check as well as the characters, since both reach a reader who has no task board

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

Respond with the one line for what was posted:

- A new issue: `✅ Issue: <url>`
- A comment on a match: `✅ Commented: <url>`

After a new issue filed with candidates kept and nobody asked, add one line per candidate, `Possible duplicate: #<NNN> <title>`, and nothing else.
