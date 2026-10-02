---
title: The pull request frame store
description: How canon pr frames pushes a UI review frame to a never-merged branch through the GitHub API and returns a branch-path link, which ref it writes, the pass segment that keeps an earlier image fixed, the refusal reasons it names, and how --drop and --prune rewrite the branch so a dropped frame leaves history
---

# The pull request frame store

`canon pr frames` gives a review comment an image it can embed. `review-ui`
drives a pull request's checklist and captures a frame per box, and a frame
on the reviewer's disk resolves for nobody else. The verb pushes one frame to
the `canon-frames` branch and returns a link to its path there.

```bash
canon pr frames 1341 --add frames/3.png --box 3 --head <sha> --pass 20261002T154450Z --json
canon pr frames 1341 --drop --json
canon pr frames --prune 30 --json
```

## What it writes

The verb writes `refs/heads/canon-frames` and no other ref. Every call goes
through the GitHub git data API, being blobs, trees, commits, and that one ref,
so nothing is checked out, no worktree is entered, and neither `main` nor any
branch a pull request holds is touched. The branch never merges.

A frame lands at `pr-<number>/<short-head>/<pass>/box-<n>.png`. `--head` names
the commit the pass drove, 7 to 40 lowercase hex characters, and defaults to
the head the pull request object reports. `--pass` is the instant the pass
started, in compact UTC as `date -u +%Y%m%dT%H%M%SZ` prints it, which
`review-ui` records once at its first step. A second pass at the same head and
box therefore writes a new file rather than replacing the image an earlier
comment shows, which matters when a preview is minted again at one head.

`link` uses the same `blob/<ref>/<path>?raw=true` form as the evidence comment,
naming the `canon-frames` branch rather than a commit. Every drop rewrites the
branch, and a link pinned to a commit would stop resolving for every other pull
request's frames once GitHub collects the commit it names. A path link lives
exactly as long as its file, so it survives every rewrite that drops another
pull request and ends only when its own is dropped.

The first `--add` creates the branch with a root commit holding the
frame, so a project needs no setup. An add only fast-forwards the ref. When
another writer moved it between the read and the move, the add rebuilds on the
new tip, up to three times, before refusing as `ref-conflict`.

Only a frame of the address the pass drove belongs here. The branch is as
public as the repository, so a frame of a private or pre-release state would
be published with it.

## What the record carries

`reason` on the record is what a caller branches on, not the exit code:

| Reason             | What it means                                                                    |
| ------------------ | -------------------------------------------------------------------------------- |
| `ok`               | An add pushed, or a drop or prune finished, including one that removed nothing.  |
| `bad-mode`         | Not exactly one of `--add`, `--drop`, `--prune`, or a number with `--prune`.     |
| `no-number`        | `--add` or `--drop` named no pull request.                                       |
| `bad-box`          | `--add` carried no positive `--box`.                                             |
| `bad-head`         | `--head`, or the head the pull request reported, is not a 7 to 40 character sha. |
| `bad-pass`         | `--add` carried no `--pass` stamp in compact UTC.                                |
| `bad-days`         | `--prune` carried no positive number of days.                                    |
| `unreadable-frame` | The `--add` file is missing, empty, or not a PNG. Nothing is called.             |
| `read-only`        | GitHub refused a write with 403 or 404, which is what a fork's token gets.       |
| `unreadable-tip`   | The branch exists and could not be read.                                         |
| `push-failed`      | A write failed partway and the ref did not move.                                 |
| `ref-conflict`     | Another writer kept moving the ref through every attempt.                        |
| `no-object-head`   | No `--head` and the pull request reported none.                                  |
| `gh-missing`       | `gh` is not on the path.                                                         |
| `gh-failed`        | `gh` could not name the repository or read the pull request.                     |

An add's `ok` record carries `link`, `commit`, `path`, `box`, `head`, `pass`,
and `created`, which is true when the add made the branch. A drop's carries
`removed`, the pull requests whose folders went, plus `commit` for the rewrite
or `deleted` when it emptied the branch. A prune adds `kept` and `unread`.

`review-ui` reads every reason but `ok` as a cue to describe the frame in words
and name the reason, so a refused push never fails the pass.

## Dropping frames

A plain delete commit would keep every image reachable through history, so
`--drop` and `--prune` write one root commit holding everything else and
force-move the ref to it. A rewrite that leaves the branch empty deletes it,
and the next add recreates it. Dropping a pull request with no frames, or on a
missing branch, reports `ok` with nothing removed, so a scheduled run never
fails on an empty branch.

`--prune <days>` reads every `pr-<n>/` folder, asks GitHub for each pull
request's state, and drops every one reading closed with a close date more
than that many days ago, in a single rewrite. It keeps one still open, one
reopened after closing, one closed exactly the given days ago, and one whose
state could not be read, listing that last kind under `unread`.

This repository runs `--prune 30` daily from
`.github/workflows/pr-frames-cleanup.yml`. A frame's file stays on the branch
until its own pull request has been closed for 30 days, so a link in a review
comment keeps resolving for about a month after its pull request closes,
whatever other pull requests the branch drops in between. A target project
carries no such workflow yet and keeps its frames until someone runs `--drop`.

## What a rewrite does not do

A force-move leaves the old commits unreachable without purging them. GitHub
serves an unreachable commit by sha until it collects it, so a dropped frame
stays reachable to anyone holding a sha from an earlier record, and a frame
holding sensitive content needs a purge request to GitHub. Its path link stops
resolving at the drop, since the branch no longer carries the file.

A drop racing an add can lose the add's frame, since GitHub's ref update has no
compare-and-swap for a force-move. The drop builds from the tip it reads, and
the window is the length of one rewrite.
