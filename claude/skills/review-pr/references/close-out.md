---
title: Rewrite a repeated close-out in place
description: The branch of review-pr Step 4 taken when the prior pass closed the review and this pass carries nothing owed, which replaces the standing close-out with a PUT rather than posting a second one
---

# A close-out that repeats the standing one

Part of Step 4 of `review-pr`, reached only on the branch `post.md` names. Everything else that step does, including the body shape and the marker, still comes from `post.md`.

When `<prior-heading>` from Step 2 reads `## Review closed` and this pass carries nothing owed, the thread already holds this verdict. Replace the standing close-out rather than posting a second one beside it.

Resolve its numeric id. `gh pr view --json reviews` carries a GraphQL node id under `id`, which no REST route accepts, so read the id off the REST listing instead:

```bash
gh api repos/{owner}/{repo}/pulls/<number>/reviews --jq '[.[] | select((.body // "") | split("\n")[0] | rtrimstr("\r") == "## Review closed")] | last | .id'
```

Write the replacement body to `<body-file>`, the name `post.md` already derived at the top of Step 4, keeping the heading and the footer and naming what this pass covered on the scope line in place of what the old one covered. Derive that name the same way whichever path reached here, since the guard reads `<prior-heading>` alone and a repeated head resolves the third segment as usual. The folder then gains a record of every covered head rather than losing the one the standing comment named. Then replace the comment:

```bash
gh api -X PUT repos/{owner}/{repo}/pulls/<number>/reviews/<review-id> -F body=@<body-file>
```

`PUT` keeps the comment's timestamp and its position in the thread, so the verdict stays where a reader already found it and the thread gains no second entry. A submitted review cannot be deleted, which is why this rewrites the standing comment rather than posting a fresh one.

The guard fires on `## Review closed` alone. Two open passes carry different findings and both are worth reading, so a repeated `## Review` posts normally. A pass carrying anything owed posts normally too, under `## Review`, which is what keeps a finding raised after a close-out from being swallowed by the guard that exists for a silent one.

The rewrite used to cost the review's `commit.oid`, which `PUT` leaves pinned at the commit the standing close-out was first submitted against. Step 2's `<prior-oid>` and the prior commit `poll.sh` derives both read that field, so the next pass read a range wider than its delta, and the poll's `SEEN` branch, which fires on `prior` equalling the head, could never be reached at all: an out-of-band pass reported as `MOVED` for the rest of the pull request's life.

The marker closes both, because `PUT` replaces the body and the marker is in it. The rewritten close-out carries the commit this pass read rather than the one the comment was first submitted against, and every reader now takes that in preference to the pinned field. The one thing `PUT` still cannot move is `submittedAt`, which stays at the original submission and is what the poll's age test reads, so a rewritten close-out ages from when it first landed rather than from when it was last rewritten. That is the correct reading for a thread waiting on a human, which is the question the age test asks.
