---
title: Rewrite a repeated close-out in place
description: The branch of review-pr Step 4 taken when the prior pass closed the review and this pass carries nothing owed, which replaces the standing close-out with a PUT rather than posting a second one
---

# A close-out that repeats the standing one

Part of Step 4 of `review-pr`, reached only on the branch `post.md` names. Everything else that step does, including the body shape and the marker, still comes from `post.md`.

When `<prior-heading>` from Step 2 reads `## Review closed` and this pass carries nothing owed, the thread already holds this verdict. Replace the standing close-out rather than posting a second one beside it.

## The rewrite

Resolve its numeric id off the REST listing, keeping the newest match across every page:

```bash
gh api --paginate 'repos/{owner}/{repo}/pulls/<number>/reviews?per_page=100' --jq '.[] | select((.body // "") | split("\n")[0] | rtrimstr("\r") == "## Review closed") | .id' | tail -n 1
```

Write the replacement body to `<body-file>`, the name `post.md` already derived at the top of Step 4. Keep the heading and the footer, and name what this pass covered on the scope line in place of what the old one covered.

- Derive that name the same way whichever path reached here, since the guard reads `<prior-heading>` alone and a repeated head resolves the third segment as usual
- The folder then gains a record of every covered head rather than losing the one the standing comment named

```bash
gh api -X PUT repos/{owner}/{repo}/pulls/<number>/reviews/<review-id> -F body=@<body-file>
```

`PUT` keeps the comment's timestamp and its position in the thread, so the verdict stays where a reader already found it. A submitted review cannot be deleted, which is why this rewrites the standing comment rather than posting a fresh one.

## When the guard fires

The guard fires on `## Review closed` alone.

- Two open passes carry different findings and both are worth reading, so a repeated `## Review` posts normally
- A pass carrying anything owed posts normally under `## Review`, so a finding raised after a close-out is never swallowed by the guard

## What the PUT leaves pinned

`PUT` leaves the review's `commit.oid` pinned at the commit the close-out was first submitted against. Step 2's `<prior-oid>` and the prior commit `poll.ts` derives would read too wide a range from it, and the poll's `SEEN` branch, firing on `prior` equalling the head, could never be reached.

The marker answers both, because `PUT` replaces the body and the marker is in it. It carries the commit this pass read, and every reader takes it in preference to the pinned field.

- `submittedAt` still stays at the original submission, and the poll's age test reads it
- A rewritten close-out therefore ages from when it first landed, which is the right reading for a thread waiting on a human
