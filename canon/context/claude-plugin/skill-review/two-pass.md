---
title: Two-pass model
description: The first pass and close-out a review posts, the body file name, the unchanged-head stop, and the repeated close-out guard
---

# Two-pass model

## Decisions

### The body file name

`review-pr` posts twice over a pull request's life, a first pass and a close-out. The body path is `body-<number>-<short-sha>.md`, since keying on the number alone would let two sessions reviewing different pull requests collide. A name the caller must choose gets chosen wrong, so the second segment is derived.

### When the head repeats

A head that stops moving leaves a later pass with no legal name. A fix in gitignored records makes no commit, because `git-followup` stops on an unchanged tree, and a finding accepted as recorded changes nothing. The close-out is still owed, since the newest heading tells an operator whether the branch is blocked.

A repeated head takes a third segment, the id of the `## Review response` comment the pass answers, with the head still leading so the second body sorts beside the first. A pass index loses because nothing in the thread carries one, so a session would count comments, which is the hand-chosen suffix the rule forbids.

### Resolving the response comment

The number is the REST `id` off the paginated issue-comments listing, because a cloud session's GitHub proxy refuses the GraphQL `gh pr view` runs on. The filter emits one id per match and `tail` keeps the newest, since `--paginate` runs the filter once per page.

- Scope the selection by the prior pass's `submittedAt`, since a heading match alone takes the newest response whatever its age, which on a re-run rebuilds the collision
- Testing whether the derived name exists on disk is weaker, because the scratch folder is gitignored and a second machine passes the test exactly where its record is missing

### Reading a repeated head

An empty derivation is a head repeating with no response behind it, so the pass stops rather than writing a second body over one commit. Where a response or rebase report sits there, it is the entire read. The equality that triggers the naming case empties Step 2's range, so the comment says whether a prior finding landed.

A late finding is the one exception, since the read also opens the file the comment names.

### Where the unchanged-head stop sits

A check inside the filename derivation reaches only a pass that composes a body, so a pass that reads the head as unchanged and does nothing else would skip it. Step 2 instead runs the response query the moment the ancestor test reports an unchanged head, ahead of the diff read and Step 3, and stops when it comes back empty.

That is the earliest point every path crosses. Step 4 still derives the third segment for a pass that proceeds, off the comment id Step 2 resolved.

### What a close-out reads

The last comment the skill posted names the commit the prior pass covered, so the close-out reads that range to the head rather than the whole change.

- The same field settles the rebase case. After a force-push the prior commit no longer reaches the head, `git merge-base --is-ancestor` exits non-zero, and the skill pays for a full pass and says so.

Scoping by the prior review's timestamp would need its own rebase test, since a commit's author date can predate the push that put it on the branch.

### One family for the stop

The equality test matches `## Review response`, `## Post-review findings`, and `## Rebase` as one family. `## Post-review findings` carries no commit behind it, exactly the shape the stop should let through, so testing it separately would refuse a late finding as it refuses an ordinary rerun.

- `## Rebase` needs no handling of its own, because a rebase moves the head and the pass takes the non-ancestor path first
- Step 2 splits on the heading. A response or rebase report skips to composing the body, and a late finding gets the file it names read at `<headRefOid>` first, as Step 3 does for a stale ticked box.

### A close-out repeating the standing one

The unchanged-head stop tests an empty range, so a pass whose head moved passes it whatever the thread says. The author may act on a change the pass called their own call, leaving the next delta empty by construction. A correct pass over real commits can then post a close-out repeating the standing one.

The guard turns on the standing verdict instead. Step 2 widens its query to return the last family review's first line beside its commit, one read answering both. Step 4 rewrites the standing close-out through `gh api -X PUT` rather than posting beside it, and `PUT` keeps the timestamp and thread position.

- The guard fires on `## Review closed` alone, since two open passes carry different findings and a repeated `## Review` stays an ordinary post

### Why not suppress or add a heading

Suppressing the pass fails twice. A reader would see a close-out naming an older commit with no way to tell whether the newer one was covered or skipped, and a test broad enough to suppress early would swallow a pass that raised a real finding.

A new heading fails because `poll.ts` matches a fixed set and reports anything else as `UNMATCHED`. `## Evidence` is in the set only because it shipped with `canon pr evidence` and the `poll.ts` exclusion together.

### The SEEN branch and the marker

`poll.ts`'s `SEEN` branch fires when `prior` equals the head. `FINAL` writes the observed head back to the baseline every tick and the report gates on `old_head`, so `head != old_head` fires once per head move regardless of `prior`.

`PUT` replaces the body and the marker rides in it, but `PUT` cannot move `submittedAt`. A rewritten close-out still ages from when it first landed, the reading the poll's age test wants.

### The commit a pass records

GitHub stamps a review with `commit.oid` and `submittedAt` at submission, and neither describes what the session read. A push landing in the compose window moves both onto a commit the pass never opened, so the next reader scopes its delta past that work and silently skips a genuine fix.

The pass writes its own record. Step 1 captures the instant before every read, and Step 4 ends every body with `<!-- review-pr: commit=<sha> read-at=<iso8601> -->`, an HTML comment a thread reader never meets. Both halves come from the top of the pass, so the compose window belongs to the next reader.

### Reading the marker

The reader takes the last non-empty line and searches nowhere else. A search for the last match anywhere would read a marker a body was displaying rather than claiming, since a fenced block showing the format trims to exactly the pattern. Position costs nothing because Step 4 already writes the marker last.

`canon pr review-state` and `src/pr/review-scope.ts` behind it are the only parser. Two readers would put one format in a skill body and a script that ship on different cadences, the drift `poll.ts`'s header already warns about.

- The record's `source` reads `marker`, `fallback` for a pass posted without one, or `none` for a thread with no pass
- The poll's age and `STALLED` branch read `submittedAt`, because how long a comment has waited on a human is a fact about the submission
- The pass instant scoping a reply query reads `readAt // submittedAt`, because what a pass had read is a fact about the read

### What the marker costs

A target whose CLI predates the verb meets a missing subcommand. The skill body and `poll.ts` both carry a written fallback that reads the stamps and reproduces the defect rather than failing, so the fix reaches a project only once a release does. The poll also spends a third `gh` read per open pull request per tick.

### A submitted review cannot be deleted

A submitted review is editable and never deletable. `DELETE /repos/{owner}/{repo}/pulls/{n}/reviews/{id}` returns 422 with `Can not delete a non-pending pull request review`, and dismissal covers approvals and change requests rather than comments.

Repair a mistimed or malformed comment with `PUT` to the same path, which keeps its timestamp and position. When the repair leaves a comment that should no longer anchor the review state, strip its heading.

- `review-pr` scopes a later pass by matching a first line against `## Review` and `## Review closed`, so a kept heading would point the next pass at the wrong commit.

### A finding links to its line

Each file-bound finding carries a permalink to its line, `<repo-url>/blob/<headRefOid>/<path>#L12` or `#L12-L14` for a span, stated once in `post.md` and shown in every template. Before, a bare backticked file block sent the reader hunting through the diff.

Inline review threads lost, because a thread changes how `review-address`, the poll, the re-review scope, and the close-out each read a review, while a link changes one bullet.

- The URL pins the full oid from Step 1 rather than the branch, so it keeps opening on the reviewed line after a push
- The pass reads the line from the file at `<headRefOid>`, not from a checkout at another commit
- A later pass restating an open finding links at its own head, since the delta may have changed the earlier code

A `**PR body**` entry, a finding on a deleted file, a finding on a line the diff removed, and a whole-file finding keep the plain bullet. A fork pull request's link is built on the base repository, which GitHub resolves through the same network, and the sandbox arm did not drive a fork.
