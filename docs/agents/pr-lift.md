---
title: The pull request draft lift
description: How canon pr lift removes the draft mark once the reviews, evidence, standing, and CI all read clear at the head, the gate order and what each reads, the wait on a pending run, the re-read before the write, the refusal reasons it names, and what --check reports
---

# The pull request draft lift

`canon pr lift` takes a pull request out of draft. It reads the gate itself, so
any session that closes a review can run it, and nobody has to judge whether a
message asking for the lift came from someone entitled to ask.

```bash
canon pr lift 1341 --json
canon pr lift 1341 --check --json
```

With no number it resolves the one open pull request on the checked-out branch.
The ship chain marks every pull request a draft, and this is the verb that
undoes it.

## What it reads

Five gates, read in this order. The first four need no wait, so they all run
before the check runs are read.

| Gate       | Clear when                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------- |
| `review`   | The newest `## Review` pass is closed, and its marker names the head.                         |
| `ui`       | The newest `## UI review` verdict is closed at the head. Binds only where a checklist exists. |
| `evidence` | `canon pr evidence --check` reads `settled`, meaning no post-pull-request step is owed.       |
| `standing` | The head merges into the base cleanly, and the base moved no path the branch writes.          |
| `ci`       | Every check run on the branch tip concluded and none failed.                                  |

The head is the branch tip read from the remote, not the pull request object's
head, which trails a push by up to a minute. A review marker names the commit
the reviewer read, and it covers the head when it is that commit or a prefix of
it.

The UI gate binds only when `canon pr evidence --check --json` carries a
`checklist` field. The verb branches on that field and not on the exit, so a
branch with no rendered surface owes no UI review.

A review pass with no read-time marker refuses as `review-unmarked`. Its covered
commit would be the stamp GitHub wrote at submission, which the marker exists to
replace, and lifting on it reintroduces the defect `canon pr review-state`
documents.

## The wait

A pending CI run is waited on rather than refused. `--wait <seconds>` bounds it,
defaulting to 1200, and the check runs are read every 30 seconds until one of
four things happens:

- every run passed, and the verb goes on to the write
- a run failed, which refuses `ci-failing` at once
- the branch conflicts with its base, which refuses `ci-conflicted` at once,
  since no run starts for a conflicted branch and the wait could not end
- the deadline passed, which refuses `ci-timeout`

A refusal on any of the first four gates comes before the wait starts. A code
reviewer whose UI partner is still driving refuses `ui-open` immediately
instead of holding a turn through a CI run.

## The re-read

A push during the wait moves the head off the commit every earlier gate
cleared. After the wait, and immediately before the write, the verb reads the
pull request, the branch tip, and the reviews again. A tip that moved refuses
`head-moved`, and a review that opened refuses with its own reason. A pull
request already out of draft by then reports `already-ready`.

Two reviewers closing within seconds of each other can each read the other's
review as still open and both refuse. The re-read narrows that window and does
not close it, so a draft whose reviews both read closed is the controlling
session's to lift.

## The write

The lift is the `markPullRequestReadyForReview` GraphQL mutation, because the
REST pull request update carries no draft field. It is the one GraphQL call the
verb makes, and every read stays on REST. The verb reads `isDraft` back from the
mutation's answer, and a response that does not say `false` refuses `gh-failed`
rather than reporting a lift.

A cloud session's proxy refuses GraphQL, so a reviewer running there reaches
`gh-failed` on the write and hands the lift to the controlling session.

## What it reports

`reason` on the record is what a caller branches on. Exit 0 covers `lifted` and
`already-ready`, so the second of two reviewers to close owes nobody a message.
Every other reason exits 1.

| Reason              | What it means                                                          |
| ------------------- | ---------------------------------------------------------------------- |
| `lifted`            | The mark came off.                                                     |
| `already-ready`     | The pull request was not a draft. Nothing is written.                  |
| `clear`             | Under `--check`, every gate reads clear.                               |
| `pull-closed`       | The pull request is closed.                                            |
| `review-missing`    | The thread carries no code review.                                     |
| `review-open`       | The newest code review is open.                                        |
| `review-unmarked`   | The newest code review carries no marker.                              |
| `review-behind`     | The newest code review closed on an earlier commit than the head.      |
| `ui-missing`        | A checklist exists and no UI review has been posted.                   |
| `ui-open`           | The newest UI review is open.                                          |
| `ui-unmarked`       | The newest UI review carries no head marker.                           |
| `ui-behind`         | The newest UI review closed on an earlier commit than the head.        |
| `evidence-owed`     | The evidence check reads `owed`.                                       |
| `standing-stale`    | The base moved under a path the branch writes.                         |
| `standing-conflict` | The head does not merge cleanly into the base.                         |
| `standing-unknown`  | The head or base did not resolve, which a fork or deleted head leaves. |
| `ci-pending`        | Under `--check`, a run has yet to conclude.                            |
| `ci-failing`        | A check run failed.                                                    |
| `ci-conflicted`     | The branch conflicts, so no run will start.                            |
| `ci-timeout`        | A run was still pending when `--wait` ran out.                         |
| `head-moved`        | A push landed during the wait.                                         |
| `gh-failed`         | A read or the write was refused, so nothing is reported as lifted.     |

`standing-unknown` waits on a person, matching the orchestrator poll's own rule
for a head it cannot resolve.

## `--check`

`--check` reports every gate and writes nothing. It reads the check runs once
and does not wait, so a pending run reports `ci-pending`. The record carries a
`gates` array with each gate's name, whether it is clear, and its reason, so a
caller sees every gate that blocks and not the first alone.

The orchestrator's poll and a session deciding whether to run the verb read the
same answer this way, rather than each restating the gate.
