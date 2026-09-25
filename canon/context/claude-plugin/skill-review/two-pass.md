---
title: Two-pass model
description: The first pass and the close-out a pull request review posts, the name a body file takes when the head repeats, where the unchanged-head stop sits, the guard against a repeated close-out, and the commit a pass records
---

# Two-pass model

## The body file name

`review-pr` posts twice over a pull request's life, a first pass and a close-out. The body path carries the head commit, `body-<number>-<short-sha>.md`, since keying on the pull request number alone would let two sessions reviewing different pull requests collide, and says nothing about one session posting twice.

A name the caller has to choose is a name the caller gets wrong in practice, so the second segment is derived rather than picked.

### When the head repeats

Deriving from the head leaves a later pass with no legal name whenever the head stops moving, which is an ordinary state rather than an error. A fix landing in gitignored records produces no commit, since the return leg delegates its push to `git-followup` and that skill stops on an unchanged tree, and a finding the worker accepts as recorded produces no change at all. The close-out is still owed on both routes, because the newest heading is what an operator reads to decide whether the branch is blocked.

So a repeated head takes a third segment off the `## Review response` comment the pass answers: the thread's id, a real object rather than a suffix someone picked, with the head still leading the name so the second body sorts beside the first. A pass index was the other candidate and it loses, because nothing in the thread carries one, so a session would have to count prior comments to pick the next, which is the hand-chosen suffix the rule forbids.

### Resolving the response comment

The number sits only in the comment `url`. `gh pr view --json comments` returns a GraphQL node id under `id`, which names the same comment in a form the thread does not show, and extracting it needs a null guard, since the jq that splits the url aborts on an empty selection.

Selecting the response is scoped by the prior pass's `submittedAt` rather than by the heading alone, since a heading match alone takes the newest response in the thread whatever its age, which resolves the id a close-out already used on a re-run and rebuilds the collision the third segment exists to prevent. Testing whether the derived name is already on disk was the other candidate, and it is weaker: the scratch folder is gitignored, so a second machine holds none of it and the test passes exactly where the record it consults is missing.

An empty derivation is a head repeating with no response behind it, so the pass has nothing to add and stops rather than writing a second body over one commit. Where a response or a rebase report sits there, it is the entire read: the equality that triggers the naming case makes Step 2's range empty, so the comment rather than the delta is what says whether a prior finding landed. A late finding is the one exception, since the read also opens the file the comment names.

## Where the unchanged-head stop sits

A check placed only inside the filename derivation reaches only the path that composes a body, so a pass reading the head as unchanged and taking no other action skips it entirely. Step 2 instead runs the same response query the moment the ancestor test reports an unchanged head, ahead of the diff read and ahead of Step 3's review, and stops there when it comes back empty. That is the earliest point every path through the skill crosses, so a pass with nothing to add cannot reach a `gh pr review --comment` call.

Step 4 still derives the third filename segment for a pass that does proceed, off the comment id Step 2 already resolved, since collision avoidance in the name is still owed once posting is decided.

Deriving it also decides what a close-out reads. The last comment the skill posted names the commit the prior pass covered, so the close-out reads that range to the head rather than the whole change. That same field settles the rebase case without a second mechanism: after a force-push the prior commit no longer reaches the head, `git merge-base --is-ancestor` exits non-zero, and the skill pays for a full pass and states that in the body. Scoping by the prior review's timestamp instead would need its own rebase test, since a commit's author date can predate the push that put it on the branch.

The equality test matches `## Review response`, `## Post-review findings`, and `## Rebase` as one family rather than `## Review response` alone. `## Post-review findings` is a reply carrying no commit behind it, which is exactly the shape the stop is meant to let through, so testing it separately would refuse a late finding the way it refuses an ordinary rerun. `## Rebase` needs no separate handling, since a rebase moves the head and the pass takes the non-ancestor path before this test ever runs. The filename segment Step 4 derives reads off the same resolution.

Step 2 splits on the heading: a response or a rebase report skips straight to composing the body, and a late finding gets the file it names read at `<headRefOid>` first, the same confirmation Step 3 runs against a stale ticked box.

## A close-out repeating the standing one

The unchanged-head stop tests an empty range, so a pass whose head moved passes it whatever the thread already says. A pass telling the author a change is their own call, followed by the author making it, leaves the next pass's delta with nothing left to say by construction, so a correct pass over real commits can still arrive carrying nothing and post a close-out that repeats the standing one.

The guard therefore turns on the standing verdict rather than on the range. Step 2 widens its existing query to return the last family review's first line beside its commit, one read answering both, and Step 4 rewrites the standing close-out through `gh api -X PUT` instead of posting beside it. `PUT` keeps the timestamp and the position in the thread, so the verdict stays where a reader last found it.

Suppressing the pass was one alternative and it fails twice: a reader scanning the thread would see a close-out naming an older commit with no way to tell whether the newer one was covered or skipped, and a test broad enough to suppress early would swallow a pass that raised a real finding.

A further heading was the other alternative, and the closed set `poll.sh` matches against closes it outright: the script matches a fixed set in jq and reports anything else as `UNMATCHED`, so a new heading invented here without a matching change to that set would break the classification it was meant to clarify. `## Evidence` is in the known set on that same condition, having shipped with `canon pr evidence` and the `poll.sh` exclusion together rather than one ahead of the other.

`poll.sh`'s `SEEN` branch fires when `prior` equals the head. Since `FINAL` writes the head the run observed back to the baseline every tick and the report gates on `old_head`, `head != old_head` fires once per head move regardless of what `prior` says, rather than repeatedly on every later tick that finds the same unmoved head.

The read-time marker covered next closes the rest: `PUT` replaces the body and the marker rides in it, but `PUT` cannot move `submittedAt`, so a rewritten close-out still ages from when it first landed, which is the reading the poll's age test wants.

The guard fires on `## Review closed` alone. Two open passes carry different findings and both are worth reading, so a repeated `## Review` stays an ordinary post.

## The commit a pass records

GitHub stamps a review with `commit.oid` and `submittedAt` when it is submitted, and neither describes what the reviewing session read. A push landing in the compose window moves both onto a commit the pass never opened, so the next reader scopes its delta past that work and reports it covered, which is a genuine fix silently skipped rather than a false alarm.

The pass writes its own record instead. Step 1 captures the instant ahead of every read it makes, and Step 4 ends every body with `<!-- review-pr: commit=<sha> read-at=<iso8601> -->`, an HTML comment a reader of the thread never meets. Both halves of the marker come from the top of the pass rather than from the post, so the window belongs to the next reader rather than being claimed by this one.

The reader takes the last non-empty line and searches nowhere else. Searching for the last match anywhere would read a marker a body was displaying rather than claiming, since a fenced block showing the format on its own line trims to exactly the pattern, and whole-line anchoring alone does not separate the two, since it only defeats the inline form where backticks leave the trimmed line unmatchable. Position costs nothing, since Step 4 already writes the marker last in every body.

`canon pr review-state`, and `src/pr/review-scope.ts` behind it, is the only parser of that marker. Two readers would put one format in a shipped skill body and a shipped bash script that ship on different cadences, which is the drift `poll.sh`'s own header already warns about for the posted headings. The record carries `source`, reading `marker` for a pass that wrote one, `fallback` for one posted without a marker, and `none` for a thread with no pass, so a caller can tell a read-time answer from a stamped one rather than trusting every commit alike.

The stamps stay live for the question each is right about. The poll's age and its `STALLED` branch read `submittedAt`, since how long a comment has waited on a human is a fact about the submission, and the pass instant that scopes a reply query reads `readAt // submittedAt`, since what a pass had read is a fact about the read.

What it costs is a release of silence and a round trip. A target whose CLI predates the verb meets a missing subcommand, and both the skill body and `poll.sh` carry a written fallback that reads the stamps and reproduces the defect rather than failing, so the fix reaches a project only once a release does. The poll also spends a third `gh` read per open pull request per tick, on top of the payload and `canon pr head`.

## A submitted review cannot be deleted

A submitted pull request review is editable and never deletable. `DELETE /repos/{owner}/{repo}/pulls/{n}/reviews/{id}` returns 422 with `Can not delete a non-pending pull request review`, and dismissal covers approvals and change requests rather than comments, so a mistimed or malformed comment is repaired with `PUT` to the same path, which replaces the body and keeps its timestamp and position in the thread. When the repair leaves a comment that should no longer anchor the review state, strip its heading, since `review-pr` scopes a later narrow pass by matching a comment's first line against `## Review` and `## Review closed` and would otherwise point the next pass at the wrong commit.
