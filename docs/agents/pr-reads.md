---
title: Head-sensitive pull request reads
description: Resolving a branch tip from the remote rather than from the pull request object, reading what a review pass covered off its own marker rather than off GitHub's submission stamps, why an empty run list is not a pass, the refusal reasons each verb names, and what the remote read costs
---

# Head-sensitive pull request reads

`canon pr head`, `canon pr checks`, and `canon pr review-state` each answer about a commit, and each exists because the field GitHub offers answers a different question. The first two resolve the branch tip from the remote with `git ls-remote` rather than taking the pull request object's word for which commit the branch is on. The third reads what a review pass covered off a marker the pass wrote, rather than off the head GitHub stamped when the review was submitted.

```bash
canon pr head
canon pr head 1341 --json
canon pr checks
canon pr checks 1341 --json
canon pr review-state
canon pr review-state 1341 --json
```

## The pull request object is not the authority for a head

`gh pr view --json headRefOid` reads a field on the pull request object. That object trails the branch ref by up to a minute after a push and carries nothing saying how far behind it is, so a session that keys a read on it is describing whichever commit GitHub last folded into the object.

Two failures on 2026-09-01 came off that one field. A reviewing session posted a finding calling a pushed commit unpushed. A worker fired a green claim and retracted it on its own thread minutes later. Neither session did anything wrong with the value it was handed. The value was stale and said so nowhere.

The remote ref carries no such lag. `git ls-remote --heads origin <branch>` asks the remote itself rather than a tracking ref, which is only as current as the last fetch, and the push worth catching is the one this process never saw.

The argument is stated here once. The shipped skill bodies call the verb rather than repeating it, because a sentence telling a session to compare two shas is a sentence a session can decide it already followed.

## What each verb answers

`canon pr head` reports `fresh` when the object and the remote name the same commit and `stale` when they disagree, with both shas on the record. The tip is the authority and the object's head is the claim being checked against it.

`canon pr checks` reads `repos/{owner}/{repo}/commits/<tip>/check-runs` and collapses it to `passing`, `failing`, or `pending`. A failure outranks a run still going, since a run in flight cannot clear a job that already failed.

`canon pr review-state` reports `heading` and `state` for the newest pass in the review family, `commit` and `readAt` for what it covered, `submittedAt` for when GitHub recorded it, and `source` for which of those readings answered. A thread carrying no pass reports `state` and `source` both as `none` with nothing else on the record.

`gh pr checks` cannot be made to answer this question at all, which is the argument for the move rather than a preference between two working commands. Its `--json` field set is `bucket, completedAt, description, event, link, name, startedAt, state, workflow`, with no sha among them, so a caller cannot even learn which commit its answer describes.

## A review's stamps describe the submission, not the read

`commit.oid` on a review names whatever the pull request head was at the instant the review was submitted. `submittedAt` names that instant. Neither names the commit the reviewing session actually opened, and the two are only the same when nothing was pushed while the comment was being written.

A push landing in that window moves both onto a commit nobody reviewed. The next pass then scopes its delta past that commit and reports it covered, which is the failure direction that loses work: the commit is skipped rather than re-read. It fired on a pull request in this toolkit on 2026-09-07, where a pass read one commit, the branch pushed another during the compose, and the poll reported the second as already seen. What it skipped was a genuine fix, and a reader comparing the sha in the report against the sha in the pass caught it.

`review-pr` therefore ends every body it posts with a marker naming what it read:

```markdown
<!-- review-pr: commit=<sha> read-at=<iso8601> -->
```

Both values are taken at the top of the pass rather than at the post, so the compose window falls outside what the marker claims. An HTML comment renders as nothing on GitHub, so a reader of the thread never meets it.

The last non-empty line is where it has to sit, and the reader looks nowhere else. Searching a body for the last match instead reads a marker the body was displaying rather than claiming, since a fenced block showing the format on its own line trims to exactly the pattern, and a pass carrying no marker of its own would then hand the next reader a commit taken from an illustration. That is the same defect through a second door, so position rather than shape is what separates a claim from a quotation.

`canon pr review-state` is the only parser of that format. Two parsers was the alternative, one in the shipped skill body and one in the orchestrator poll's jq, and those two ship on different cadences, so a format change to either would leave the other reading a reviewed commit as unreviewed.

`source` on the record says which reading answered, and a caller checks it before trusting the rest:

| Source     | What it means                                                                               |
| ---------- | ------------------------------------------------------------------------------------------- |
| `marker`   | The pass wrote its own read-time record, which is the authority                             |
| `fallback` | A pass posted before this shipped, read off the submission stamps and carrying their defect |
| `none`     | The thread carries no pass, so the next one is a first pass                                 |

The record carries `submittedAt` beside `readAt` rather than in place of it, because each is right about a different question. What a pass had read is a fact about the read, and how long a posted comment has waited on a human is a fact about the submission. The orchestrator poll reads the first for its coverage test and the second for its age test.

A `PUT` rewrite of a standing close-out inherits the fix without a mechanism of its own. That request replaces the body and the marker rides in it, so a rewritten comment names the commit the rewriting pass read. `submittedAt` stays pinned to the original submission, which is the reading the age test wants anyway.

## An empty run list is not a pass

Keying the query on a sha is necessary and not sufficient. The endpoint answered with `total_count` 2 and an empty row list during a measured window on 2026-09-02, so a reader that finds no run for the tip and reports `passing` reproduces the false green behind a better query.

Both empty cases report `pending` instead: a tip carrying no run yet, and a listing whose rows all belong to some other commit. The record separates them, since `matched` counts the runs belonging to the tip and `foreign` counts the rest, and a caller that wants to tell "not started" from "still going" reads those two numbers rather than the state alone.

The verb keeps the newest run per check name rather than rolling every matched run into the state. A workflow that fires twice on one commit used to leave its first, stale run beside the rerun, where a failing one could outvote a passing rerun. Grouping the matched set by name and keeping the highest `id` per group removes that stale run before the rollup runs. `collapsed` on the record counts what the fold discards, so a caller reading it against `matched` sees the dedupe directly, instead of reading a `matched` above the check count as the verb disagreeing with `gh pr checks`.

A conflicted branch produces no check runs rather than a failing one. GitHub builds no merge ref for it, so no `pull_request` workflow starts and the listing stays empty, which reads as `pending` and never leaves it. `mergeStateStatus` is the field that separates the two, and the record carries `conflicted: true` and `mergeState` when it reads `DIRTY` with no run belonging to the tip. A `DIRTY` reading beside runs on the tip leaves the state as those runs say, since a conflict arising after they completed does not unsay them. `UNKNOWN` is transient while GitHub computes the merge state, right after a push, so it reads as not conflicted and costs one more poll. A binary predating the field keeps answering `pending`.

A listing carrying even one foreign run reports `pending` whatever the matching half says. A set that describes another commit says nothing about this one, so answering off the rows that happen to match would put a verdict on a set already known to be incomplete.

A count above the rows returned reports `pending` for the same reason. The query asks for 100 rows against the endpoint's default of 30, and a commit carrying more than that comes back short, so the verb reports the tip as unread rather than collapsing the page it happens to hold. `reported` against `matched` and `foreign` is where a reader sees which of the three shapes produced the answer.

## Reading the answer

Branch on the record rather than on the exit. Both verbs exit 0 whenever they resolved a tip, whatever the verdict, and 1 only when they refused. An operator shell profile can wrap `canon` in a function whose status comes from a trailing command, which flattens every non-zero exit to 0, so the exit is not a channel either verb puts a verdict on. `gh pr checks` reserving exit 8 for pending is the pattern being replaced rather than one to copy.

Each refusal names a different repair:

| Reason               | What it means                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `gh-missing`         | `gh` is not on the path, so no pull request resolved                                       |
| `gh-failed`          | `gh` could not answer for this branch, so name a number instead                            |
| `no-branch`          | The pull request carries no head branch name, so no ref could be read                      |
| `unresolvable-ref`   | The remote read failed, which is not the same answer as an absent branch                   |
| `no-remote-branch`   | The remote carries no branch by that name, so there is no tip to compare against           |
| `no-object-head`     | The pull request object reported no head, so `head` has nothing to compare the tip against |
| `runs-unreadable`    | The check runs for the tip could not be read, which is unread rather than none             |
| `reviews-unreadable` | The reviews on the pull request could not be parsed, which is unread rather than none      |

A failed remote read and a branch the remote does not carry stay apart rather than collapsing into one reason. Reading the first as the second would report a network refusal as a deleted branch, and the repairs have nothing in common.

## What it costs

One remote round trip per call, sampled here at 0.41s, 0.55s, and 0.67s on 2026-09-01 and 2026-09-02, against 0.001s for the local ref read. The spread is the network rather than the command, so read it as roughly half a second and not as a figure to compare a later reading against. Every caller pointed at these verbs already spends a `gh` round trip on the same line, so the added cost lands on a path that was never local to begin with.

One head-sensitive read is left on the object deliberately. `canon targets pulls` reads `statusCheckRollup` for every open pull request across every target, where resolving a tip per row would cost one remote read per pull request across a dozen projects, against a surface that reports a listing rather than gating a push.

The orchestrator poll spends that same read per open pull request and repeats it on a three-minute timer, which makes it the heaviest caller here rather than an exception to the paragraph above. Six open pull requests is around 120 remote reads an hour. It now spends a third read per pull request per tick besides, since `canon pr review-state` makes its own `gh pr view` call beside the payload the poll already fetched. That one is an API round trip rather than a remote ref read, and it buys a coverage test that answers about what a session read. What separates the two cases is what each reading decides rather than what it costs. The poll's head fires the review trigger, so a stale one sends a pass at a commit nobody read or withholds one that is owed. The listing decides nothing, so the same spend buys a fresher column in a report and no correctness at all.

`canon pr key-changes` also stays on the object, for a different reason. It reads the body, the file list, and `headRefOid` in one call on purpose, so the three describe one commit. That is a consistency requirement rather than a freshness one, and keying its head elsewhere would break it.
