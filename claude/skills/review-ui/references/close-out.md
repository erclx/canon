---
title: Rewrite a repeated UI close in place
description: The branch of review-ui Step 7 taken when the prior verdict closed the review and this pass owes nothing, which replaces the standing close with a PUT rather than posting a second one
---

# A UI close that repeats the standing one

Part of Step 7 of `review-ui`, reached only on the branch `post.md` names. The body shape, the scan, and the marker still come from `post.md`.

When the newest UI verdict from Step 1 reads `## UI review closed` at an older head and this pass closes too, the thread already holds this verdict. Replace the standing close rather than posting a second one beside it.

- Only a closed prior is replaced, so after a prior `## UI review` this pass's close posts normally
- A pass that owes anything posts under `## UI review` whatever the prior read, since a rewrite would hide a failed box behind a closed heading

Resolve the standing close's numeric id off the REST listing, keeping the newest match across every page:

```bash
gh api --paginate 'repos/{owner}/{repo}/pulls/<number>/reviews?per_page=100' --jq '.[] | select((.body // "") | split("\n")[0] | rtrimstr("\r") == "## UI review closed") | .id' | tail -n 1
```

## Write the replacement

Write the full body for this pass to the file `post.md` names, with the heading, the count line, and the Passed table regenerated from what this pass drove. Patching only the marker would leave a count line and an address naming the old head. A loopback address reads as a local preview here too, as on a first post.

Add one line under the count line, reading the prior head off the standing verdict's marker and the commit count off the compare:

```bash
gh api repos/{owner}/{repo}/compare/<prior-head>...<head> --jq .total_commits
```

```plaintext
Re-checked at `<short-sha>`, <N> commits since the prior pass.
```

Omit the line when the standing verdict carried no marker, since there is no prior head to count from. Run the scan `post.md` states against the file. Then record the instant just before the call, in UTC, as `<posted-at>`, since Step 9 keeps only the review-event runs created after it and the `PUT` fires one on `edited`. Replace the comment:

```bash
date -u +%Y-%m-%dT%H:%M:%SZ
gh api -X PUT repos/{owner}/{repo}/pulls/<number>/reviews/<review-id> -F body=@<body-file>
```

## The marker

The body ends on `<!-- review-ui: head=<head> -->` at the full head this pass drove, with no line below it. `PUT` leaves the review's `commit.oid` pinned at the head the close was first posted against, so `resolveUiScope`, the lift gate, and the orchestrator poll read the marker in its place.

- A body missing it reads as the pinned stamp, so the lift refuses `ui-behind` and the poll reports the close as behind
- `PUT` keeps the comment's timestamp and place, so the poll's age test reads a rewritten close as old, the reading the code review accepts
- A submitted review cannot be deleted, which is why this rewrites the standing close rather than posting a fresh one
- The standing verdict's frames sit under their own pass stamp on the frames branch, so the new body links this pass's frames and the old stay reachable by path
