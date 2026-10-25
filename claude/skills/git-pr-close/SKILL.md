---
name: git-pr-close
description: Closes an open pull request without merging it, posting a short reason first and deleting its head branch, through `canon pr close`. Use when asked to "close this PR", "close #N", "supersede #N with #M", "abandon this pull request", or "drop this PR". Do NOT use to merge, which the operator does, or to close an issue, which `git-issue` covers.
metadata:
  family: after-pr
---

# Git PR close

Close one pull request unmerged with its reason on the thread, so a later reader finds why without asking.

Read `${CLAUDE_SKILL_DIR}/references/close.md` before writing the reason, for its shape and the two forms it takes.

## Guards

- Take the number the caller named. Never guess one from the newest pull request in view, since a wrong number closes another branch's work.
- If the caller gave no reason and none follows from the conversation, stop: `❌ No reason to post. Say why this pull request is closing.`

## Step 1: write the reason

Write the reason to `.canon/tmp/pr/close/close-<number>.md` in its own call, in the shape `close.md` fixes.

## Step 2: close

Run the verb, passing `--head` when the pull request's head is not the current branch, as when closing a superseded batch from another checkout:

```bash
canon pr close <number> --reason-file .canon/tmp/pr/close/close-<number>.md --json
```

- Pass `--head <branch>` with the branch the pull request carries when it is not this checkout's
- Pass `--keep-branch` only when the caller says the branch stays
- The verb posts the reason, closes, then deletes the branch, and refuses before any write on a reason it cannot publish

## Step 3: read the record

Branch on `reason` rather than the exit, since a shell function wrapping `canon` can flatten it.

| `reason`               | Route                                                                        |
| ---------------------- | ---------------------------------------------------------------------------- |
| `closed`               | Report the comment URL, and name the branch when `branch` is `delete-failed` |
| `reason-unpublishable` | Rewrite the sentence each finding names, then run Step 2 again               |
| `head-mismatch`        | Stop and report it, since the number names another branch's pull request     |
| `close-failed`         | Report that the comment posted and the pull request is still open            |
| Any other refusal      | Report the `message` and stop                                                |

## Output

One line on a close:

```plaintext
✅ Closed #<number>: <comment url>
```
