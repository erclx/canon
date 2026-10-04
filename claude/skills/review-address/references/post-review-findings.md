---
title: Post-review findings
description: How review-address posts something worth reporting after Step 7 closed the review, being the heading, the voice and scan the body takes, the footer, and the one REST call that posts it
---

# Post a finding after the review closed

Outside the numbered flow of `review-address`. The session reads this file when it has something worth reaching the reviewing session after Step 7 already closed the review.

Not everything worth reaching the reviewing session surfaces inside the numbered flow in `SKILL.md`. A worker that settled a risk, filed a follow-up, or found something else worth reporting after Step 7 already closed the review posts it directly rather than waiting on a review pass that has nothing left to trigger it. Write the body the way Step 6 writes a reply: load `write-human` for voice and word choice, follow `${CLAUDE_SKILL_DIR}/../../standards/markdown.md` for punctuation, and run the `${CLAUDE_SKILL_DIR}/../../standards/publish.md` scan before posting with `canon labels scan --body-file .canon/tmp/pr/reply/reply-<number>.md`.

Open with `## Post-review findings` rather than `## Review response`, since nothing on the thread is being answered. `review-pr` states the full heading set this belongs to and routes it the same as a response: `role-orchestrator`'s poll picks it up and sends the reviewing session back for a pass. Close the body with `🤖 Addressed by Claude Code` on its own line, matching the reply's footer.

```bash
gh api -X POST 'repos/{owner}/{repo}/issues/<number>/comments' -F body=@.canon/tmp/pr/reply/reply-<number>.md --silent
```
