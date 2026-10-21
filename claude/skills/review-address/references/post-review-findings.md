---
title: Post-review findings
description: How review-address posts something worth reporting after Step 7 closed the review, being the heading, the voice and scan the body takes, the footer, and the one REST call that posts it
---

# Post a finding after the review closed

Outside the numbered flow of `review-address`. The session reads this file when it has something worth reaching the reviewing session after Step 7 already closed the review, such as a settled risk, a filed follow-up, or another finding. It posts directly rather than waiting on a review pass that has nothing left to trigger it.

## The body

Write the body the way Step 6 writes a reply.

- Load `write-human` for voice and word choice, and follow `${CLAUDE_SKILL_DIR}/../markdown-craft/references/markdown.md` for punctuation
- Run the `${CLAUDE_SKILL_DIR}/../git-pr/references/publish.md` scan before posting, with `canon labels scan --body-file .canon/tmp/pr/reply/reply-<number>.md --json`
- Stop on a `density` entry as on any hit, since a post's density never sets the exit code
- Open with `## Post-review findings` rather than `## Review response`, since nothing on the thread is being answered
- Close the body with `🤖 Addressed by Claude Code` on its own line, matching the reply's footer

Give each finding one line under 200 characters in the response's shape, naming its severity, its file and line, and what holds now or what was filed.

`review-pr` states the full heading set this belongs to and routes it the same as a response, so `role-orchestrator`'s poll picks it up and sends the reviewing session back for a pass.

```bash
gh api -X POST 'repos/{owner}/{repo}/issues/<number>/comments' -F body=@.canon/tmp/pr/reply/reply-<number>.md --silent
```
