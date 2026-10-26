---
name: pr-evidence
description: Posts the rendered-surface evidence on an open pull request, being the screenshot comparison with the UI checklist, the checklist alone when git refuses the comparison, the local server link, and the preview address, editing the one marked comment in place on every later head. Use when asked to "post the evidence", "refresh the screenshots on the PR", or "re-post the evidence on the new head", and as the closing step of `git-pr`. Do NOT use to write a pull request's title or body, which is `git-pr`, or to write the checklist, which is `ui-checklist`.
metadata:
  family: after-pr
---

# PR evidence

The evidence a pull request carries is owed again on every new head, while its title and body are not. This skill posts it against one pull request number, so `git-pr` runs it as its last step and any session can run it alone after a push.

## Resolve the pull request

Take the number the caller passed and look nothing up. `git-pr` passes the number its final command printed, and never invokes this skill when that command refused on a head mismatch and printed none.

Run bare, resolve the open pull request for the current branch:

```bash
canon pr head --json
```

Read `reason` on the record rather than the exit code, since a shell function wrapping `canon` can flatten it to zero.

- A record carrying `number`: hold it for every step below
- Any refusal, including `gh-failed` for a branch with no open pull request, stops the run with `❌ No open pull request resolved for this branch: <message>. Pass the number and re-run.`
- Never create a pull request here and never guess a number, since a write to a wrong number lands on another branch's thread

## Post the evidence

Read `${CLAUDE_SKILL_DIR}/references/evidence.md` and run its sections in order against the number, being the checklist, the local server, the reel, the evidence comparison, the checklist alone, and the preview address.

- Every post and edit goes through `gh api` over REST, since a cloud session's proxy refuses the GraphQL that `gh pr` runs on
- Never judge from the diff whether an evidence image changed, since the verb answers `no-evidence` for a branch that changed none and a session cannot see an image it did not author
- A lone run on a later head edits the marked comment through the record's `commentId` and passes no `--checklist` for a handoff already deleted, since the verb carries the checklist forward

## Report

Collect only the lines below whose condition holds, and nothing when none does. A lone run prints them. A run another skill invoked hands them back to that caller and prints nothing, since `git-pr` prints its own result line and then these lines, and printing here too shows them twice.

| Condition                                                 | Line                                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| A checklist posted in the evidence comment                | `📋 Posted the UI checklist to <number>, in the evidence comment.` |
| A checklist posted alone                                  | `📋 Posted the UI checklist to <number>, on its own.`              |
| The preview step returned an address                      | `🔗 Preview: <url>`                                                |
| The evidence step posted the local link                   | `🖥️ Local preview: <url>`                                          |
| The local step refused and evidence or a checklist posted | `🖥️ No local preview: <reason>: <message>`                         |
| The reel step posted a reel                               | `🎞️ Reel: <link>`                                                  |
| The reel step skipped with a reason                       | `🎞️ No reel: <reason>: <message>`                                  |
| A git refusal or a preview refusal the reference reports  | `⚠️ <reason>: <message>`                                           |

### The no-local-preview line

It fires when the local step refused under any reason the reference holds, `unhealthy` included, since that pull request changes a rendered surface and a reviewer could have used the link. The `message` names what to fix, such as the failing health path. A later run only carries a link forward, so it cannot add one the comment never had.

To add the link later, start the server and run this skill again, adding `--checklist` to the evidence call when one is still owed.
