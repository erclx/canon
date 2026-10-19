---
title: Resolve the pull request without the verb
description: Step 1 of review-ui on a target whose CLI predates canon pr head, which reads the number and the head straight off the REST pulls endpoint
---

# Resolve the pull request without the verb

Step 1 of `review-ui`, read when `canon pr head` returns no record.

Every read here runs on REST, since `gh pr` runs on GraphQL and a cloud session's proxy refuses it. A target whose CLI predates the verb gets no record back, so read the pull request directly:

```bash
gh api "repos/{owner}/{repo}/pulls?head={owner}:$(git branch --show-current | jq -Rr @uri)&state=open" --jq '.[].number'
gh api repos/{owner}/{repo}/pulls/<number> --jq .head.sha
```

- With no number named, take the open pull requests on the current branch, and stop when that prints anything but one number
- A named number skips that lookup, since this checkout's branch need not be the pull request's
