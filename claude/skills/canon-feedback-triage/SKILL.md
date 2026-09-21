---
name: canon-feedback-triage
description: Triage open GitHub issues labeled `feedback` in the toolkit repo. List them, pick one, classify it as a direct fix or plan-worthy work, route to the right skill, and link the issue for close-out. Use when asked to "triage toolkit feedback", "work through the feedback issues", "process feedback issues", or "what feedback is open". Do NOT use to file new feedback (that is `canon-feedback`), or for general GitHub issue triage unrelated to toolkit feedback.
---

# Canon feedback triage

Consume the feedback queue that `canon feedback --github` fills. Turn an open `feedback` issue into a scoped fix or a plan, then link the issue so merge closes it.

Run from the toolkit repo root. This skill reads GitHub issues, not local `.canon/review/` files. Those are ephemeral session scratch. The durable, cross-project queue is GitHub.

## Guards

- If `gh` is not on PATH, stop: `❌ gh CLI not found. Install it to read feedback issues.`
- If `gh auth status` fails, stop: `❌ gh is not authenticated. Run gh auth login.`
- If no open `feedback` issues exist, stop: `✅ No open feedback issues.`

## Step 1: list the queue

Fetch open feedback issues:

```bash
gh issue list --label feedback --state open --json number,title,url --jq '.[] | "#\(.number)\t\(.title)\t\(.url)"'
```

Print each as a numbered line with its issue number, title, and URL. Do not open bodies yet. Ask which to triage, and accept "all" to work them in order.

## Step 2: read and classify

For each picked issue, read the body:

```bash
gh issue view <n> --json title,body,labels --jq '"\(.title)\n\n\(.body)"'
```

Classify against the toolkit's own surfaces. Score in this order and stop at the first match:

1. **Direct fix.** One surface, one file, no architectural choice. A typo, a stale reference, a one-line rule or doc correction, a single wording fix. Route straight to the edit.
2. **Plan-worthy.** Multiple files, a new skill or rule, a behavior change, or a cross-surface move. Route to `plan-feature`.
3. **Needs clarification.** The observed and expected behavior conflict or the surface is unnamed. Comment on the issue asking for the missing detail, then skip it.

State the class and the one-line reason per issue before routing. Do not batch unrelated fixes into one branch.

## Step 3: route

- Direct fix: rename the branch to a conventional name (invoke `git-branch`), make the edit, then open the PR with `git-pr`.
- Plan-worthy: invoke `plan-feature` with the issue body as the feature description. Let it write the plan and stop. Hand the plan slug back to the user. Do not implement.
- Needs clarification: run the scan in `${CLAUDE_SKILL_DIR}/../../standards/publish.md` against the question first, since it reaches the remote with nothing else checking it and this scan is the only gate. Then `gh issue comment <n> --body "<one question>"`, and move on.

Match one issue to one branch and one PR. A single feedback issue is a single unit of work.

## Step 4: close-out

Link every fix back to its issue so the queue drains on merge.

- For a PR-backed fix, add a `Closes #<n>` line to the PR body so GitHub closes the issue on merge. When `git-pr` regenerates the body, keep that line.
- For a fix that ships without a PR, run the scan in `${CLAUDE_SKILL_DIR}/../../standards/publish.md` against the close message first, since it reaches the remote with nothing else checking it and this scan is the only gate. Then close it directly: `gh issue close <n> --comment "Fixed in <commit or PR url>."`
- For a plan-worthy route, leave the issue open. It closes when the resulting PR merges with its `Closes #<n>` line.

## Notes

- The `feedback` label is what `canon feedback --github` and the `toolkit-feedback.yml` issue form both apply. An issue without it does not surface here by design.
- This skill routes, it does not reimplement. `plan-feature` owns planning, `git-pr` owns the PR body, `git-branch` owns the branch name. Do not duplicate their logic.
