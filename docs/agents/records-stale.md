---
title: Records stale
description: Reading the memory pen as a review queue, what makes an entry due, how a cited path is read and resolved, the order entries come back in, counting the releases since the requirements and architecture records were last reviewed, and the exit codes and refusals
---

# Records stale

`canon records stale memory` reports each memory entry's review state and every backticked path it cites that the project no longer holds. It answers what a review of the pen should read next, so a skill takes the queue from the verb rather than re-deriving it by grep. `canon records stale canonical` reports when the requirements and architecture records were last reviewed and how many releases have shipped since.

```bash
canon records stale memory
canon records stale memory --json
canon records stale memory --days 60 --json
canon records stale canonical --json
```

| Option          | Behavior                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------- |
| `--json`        | Add a machine-readable record on stdout                                                             |
| `--days <n>`    | Days after a review before a memory entry is due again (default 30)                                 |
| `--root <path>` | Project root, defaulting to the main worktree for `memory` and the current worktree for `canonical` |

`memory` and `canonical` are the two kinds it reads, since each is a record carrying a review date. Any other argument refuses as `unknown-kind`.

It reports and never writes. It moves, archives, and rewrites no entry, matching `validate` and `size`.

## What makes an entry due

An entry is due when its frontmatter carries no `reviewed` date, or one older than `--days`. The field is optional, and a review that keeps an entry is what writes it, per `standards/memory.md`. A `reviewed` value that is not a `YYYY-MM-DD` calendar date reads as never reviewed, and the record carries the raw value as `invalidReviewed` so a review can see it rather than the verb throwing over one hand edit.

The field is read off the raw frontmatter block rather than a parsed value, since a YAML parser resolves a bare date to a date object on one schema and a string on another.

## Cited paths

A cited path is a backticked token holding a `/` and ending in a file extension. A trailing `:12`, `:12-20`, or `#heading` anchor is stripped before the test, since otherwise every line citation reads as missing. The path resolves against the project root and never against the entry's own folder, because an entry cites the tree it was written about.

Tokens that look like paths and cite nothing in the tree are never reported:

- Anything under `.canon/`, the scratch folder, or `.claude/worktrees/`, which no tree commits
- A placeholder or glob holding `<`, `*`, or `{`, a variable holding `$`, and a path elided with `...`
- A URL, an absolute path, a home path, and a path opening with `../`

A missing path is a proxy for an entry the tree has moved under, not a verdict. It misses a rule the tree now contradicts in prose, and in a target project it flags a toolkit path the target never held. The review judges each one rather than retiring on the flag alone.

## Order

The pen is read at its top level alone. `review/` holds receipts, `archive/` holds retirements, and `index.md` is the generated catalog, so none is an entry a review would queue.

Entries come back due first. Among the due entries, one citing a missing path leads, then the longest unreviewed, with a never-reviewed entry ahead of any dated one, then by name so two runs over one pen agree. A caller takes the first N as a batch:

```bash
canon records stale memory --json | jq -r '[.entries[] | select(.due)][0:20][] | .name'
```

The record carries `total`, `due`, `days`, the `folder` read relative to the root, and one `entries` row per entry with `name`, `category`, `reviewed`, `due`, and `unresolved`.

## Canonical records

`canonical` reads `REQUIREMENTS.md` and `ARCHITECTURE.md` at whichever surface root carries each, `canon/` ahead of `.claude/`, and omits one the project does not hold. Both are tracked, so `--root` defaults to the worktree the caller stands in rather than the main one, and a stamp a branch just wrote reads back from that branch.

Each doc's review point is an optional `reviewed: YYYY-MM-DD` frontmatter field, set by whoever finishes a review, per `canon standards requirements` and `canon standards architecture`. It is a date rather than a commit, since a commit written on a feature branch never reaches a trunk that squash-merges. The field is read the way the memory field is, so a value that is not a calendar date comes back as `invalidReviewed`.

The count is every release tag merged into `HEAD` whose creator date falls after the reviewed day. A release tag ends in a dotted version, bare as `v5.25.0` or behind a component prefix as `canon-v2.1.0`, so an eval, deploy, or snapshot tag on the trunk never inflates it. A lightweight tag's creator date is its commit's date and an annotated tag's is the tagging date, so a project mixing both counts by two clocks.

The record carries `tagged`, false when `HEAD` has merged no release tag or the repository has no commit yet, and one `docs` row per doc with `path`, `reviewed`, `releasesSince`, and `latestRelease`. `releasesSince` is null on a doc never reviewed and `0` on one reviewed after every tag. With no tags it is also `0`, which is why `tagged` travels beside it.

It gates nothing, and no hook, gate stage, or workflow runs it. `canon:document-health` reads it when asked to review the two records.

## Exit codes and refusals

Exit codes: `0` the reading completed, whatever it found, and `1` refused. A due entry is a queue position rather than a failure, so nothing here gates.

A `reason` field carries which gate fired: `no-folder` when the project holds no memory folder at either record root, `unknown-kind` for any kind but `memory` or `canonical`, `bad-days` when `--days` is not a positive whole number or is passed to `canonical`, and `unreadable-tags` when `canonical` cannot read the tags. An empty pen is not a refusal. It reports an empty list and exits `0`.

The pen is shared scratch at the main worktree root, so `--root` defaults there, the same default `validate memory` takes. A pen at the legacy `.claude/memory/` root resolves the way every record verb resolves it, per `records.md`. <!-- canon-keep-record-root -->
