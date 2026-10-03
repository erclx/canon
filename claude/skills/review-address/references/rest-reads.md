---
title: REST reads
description: The reads review-address runs over REST, being the findings on the pull request, plus the pull request lookup and the check runs it falls back to when the installed canon predates pr head or pr checks
---

# REST reads

The guard and Step 1 of `review-address`. The session reads this file on reaching Step 1, and from the guard when `canon pr head --json` hands back no `number`. Every read runs on REST, since the `gh pr` subcommands run on GraphQL and a cloud session's GitHub proxy refuses it. A cloud worker answering a review runs this skill, so one GraphQL call breaks the whole leg.

## The findings

Read the reviews, the thread's comments, and the inline review comments:

```bash
gh api --paginate 'repos/{owner}/{repo}/pulls/<number>/reviews?per_page=100' --jq '.[] | {id, user: .user.login, state, commit_id, submitted_at, body} | @json'
gh api --paginate 'repos/{owner}/{repo}/issues/<number>/comments?per_page=100' --jq '.[] | {id, user: .user.login, created_at, body} | @json'
gh api --paginate 'repos/{owner}/{repo}/pulls/<number>/comments?per_page=100' --jq '.[] | {id, user: .user.login, path, line, body} | @json'
```

Each read prints one JSON line per row, oldest first across every page. A multi-line body stays inside its own row, and the newest review is the last line of the first read rather than the last row of its first page. `--paginate` runs the filter once per page, so never reduce inside it with `last` or `max`.

## The pull request on the branch

The guard's fallback, for a target whose CLI predates `canon pr head`. Read the open pull requests on the branch and the head of the one it finds:

```bash
gh api "repos/{owner}/{repo}/pulls?head={owner}:$(git branch --show-current | jq -Rr @uri)&state=open" --jq '.[].number'
gh api repos/{owner}/{repo}/pulls/<number> --jq .head.sha
```

The branch is encoded so a `/` in its name reaches the query as `%2F`. Written bare, it resolves nothing and reads as no open pull request.

Nothing printed takes the guard's no-PR stop. More than one number takes its `ambiguous-pull` stop rather than the first, since two open pull requests on one head against different bases leave nothing to say which one the review is on.

## The check runs on the tip

Step 1's fallback, for a target whose CLI predates `canon pr checks`:

```bash
gh api --paginate 'repos/{owner}/{repo}/commits/<tip>/check-runs?per_page=100' --jq '.check_runs[] | {name, status, conclusion} | @json'
```

A run whose `status` is not `completed` is pending. A tip listing no run at all is pending too rather than green, the same reading `canon pr checks` gives it.
