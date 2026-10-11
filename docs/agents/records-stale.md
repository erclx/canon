---
title: Records stale
description: Counting the releases since the requirements record was last reviewed, where the review date is read from, and the exit codes and refusals
---

# Records stale

`canon records stale canonical` reports when the requirements record was last reviewed and how many releases have shipped since. A skill takes the count from the verb rather than re-deriving it from the tag list.

```bash
canon records stale canonical
canon records stale canonical --json
```

| Option          | Behavior                                                          |
| --------------- | ----------------------------------------------------------------- |
| `--json`        | Add a machine-readable record on stdout                           |
| `--root <path>` | Project root, defaulting to the current worktree rather than main |

`canonical` is the one kind it reads. Any other argument refuses as `unknown-kind`, including `memory`, which the verb read until the memory pen retired.

It reports and never writes, matching `validate` and `size`.

## Canonical records

`canonical` reads `REQUIREMENTS.md` at whichever surface root carries it, `canon/` ahead of `.claude/`, and omits it when the project does not hold one. It is tracked, so `--root` defaults to the worktree the caller stands in rather than the main one, and a stamp a branch just wrote reads back from that branch.

The review point is an optional `reviewed: YYYY-MM-DD` frontmatter field, set by whoever finishes a review, per `canon standards requirements`. It is a date rather than a commit, since a commit written on a feature branch never reaches a trunk that squash-merges. The field is read off the raw frontmatter block rather than a parsed value, since a YAML parser resolves a bare date to a date object on one schema and a string on another. A value that is not a calendar date reads as never reviewed, and the record carries the raw value as `invalidReviewed` so a review can see it rather than the verb throwing over one hand edit.

The count is every release tag merged into `HEAD` whose creator date falls after the reviewed day. A release tag ends in a dotted version, bare as `v5.25.0` or behind a component prefix as `canon-v2.1.0`, so an eval, deploy, or snapshot tag on the trunk never inflates it. A lightweight tag's creator date is its commit's date and an annotated tag's is the tagging date, so a project mixing both counts by two clocks.

The record carries `tagged`, false when `HEAD` has merged no release tag or the repository has no commit yet, and one `docs` row per doc with `path`, `reviewed`, `releasesSince`, and `latestRelease`. `releasesSince` is null on a doc never reviewed and `0` on one reviewed after every tag. With no tags it is also `0`, which is why `tagged` travels beside it.

It gates nothing, and no hook, gate stage, or workflow runs it. `canon:document-health` reads it when asked to review the two records.

## Exit codes and refusals

Exit codes: `0` the reading completed, whatever it found, and `1` refused. A release count is a prompt for the review to judge rather than a failure, so nothing here gates.

A `reason` field carries which gate fired: `unknown-kind` for any kind but `canonical`, and `unreadable-tags` when the tags cannot be read.
