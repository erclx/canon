---
title: Architecture anchor staleness sweep
description: How an anchored decision's cited paths are collected, the finding the diff fires, and the report line
---

# Architecture anchor staleness sweep

Mechanics for Step 5 of `docs-fold`. The body owns the skip conditions, the report-only constraint, and the standard citation, and this file owns what the sweep does once the diff touches a path an anchored decision cites.

## Anchored entries

Read `canon/ARCHITECTURE.md` and take the H3 entries under `## Key technical decisions`. An entry is anchored when its reasoning closes on the marker the standard fixes:

```plaintext
Measured at <short-sha> on <YYYY-MM-DD>.
```

Skip every entry without one. An unanchored entry either predates the rule or cites no measured number, and the standard calls both correct, so the sweep has nothing to say about either.

For each anchored entry, collect the backticked code paths its reasoning cites. Same read the diagram sweep runs over an explanation, against a paragraph instead of a diagram.

Most of these name a folder rather than a file, because the number an entry anchors is usually a count over a tree. Match accordingly:

- A citation naming a file matches when the diff carries that file, wherever it sits. A file at the repository root such as `CLAUDE.md` is a file citation like any other.
- A folder citation, which is one ending in a slash, matches when the diff carries any path under it.
- A folder citation of a single segment matches nothing and is skipped.

The third rule reaches folders alone, which is what keeps it off `CLAUDE.md`. Breadth is the whole reason it exists, and a root file has none: it names one path the diff either carries or does not.

What it does stop is a citation of `.claude/` matching every branch. `src/`, `scripts/`, and `.claude/` each name a tree a project organizes most of its work under, so a prefix match on one fires constantly and rebuilds the ignored warning this sweep exists to avoid. Measured against this repository's record, the skip drops 13 of the 26 folder citations and keeps the ones carrying a signal, among them `src/tooling/`, `.claude/rules/`, and `governance/rules/`.

A decision whose folder citations are all a single segment, and which cites no file, therefore never fires. That is the correct outcome rather than a gap: a count over a whole tree moves on nearly every branch, so flagging it every time tells a reader that time has passed and nothing else.

## The finding

Report an entry when the diff touches one of its cited paths, however it was touched. A delete, a rename, and an edit inside the file all move a count of what sits under that path, and the entry's number was read before any of them landed. The diagram sweep narrows to deletes because a diagram survives a body edit, and a number does not.

The anchor's own SHA settles nothing here. A branch is compared against its merge base rather than against the commit the anchor names, so an entry anchored at a commit this branch already contains is still due a read once the branch moves what it counted.

Report an entry once however many of its cited paths the diff carries. Name the first as the evidence and leave the rest, since the reader opens the entry either way and a line per path buries the entry it is about.

What this misses is a claim whose number moved with no matching citation in the diff, whether because the branch never touched the tree it counts or because the entry cites nothing narrower than one segment. That is the recall this trades for precision, and the alternative is re-running an arbitrary measurement read out of prose, which no sweep does reliably.

## What the sweep never does

- Write into the entry. The record carries no frontmatter, so the marker and the claim share one paragraph and an edit reaching one reaches the other.
- Refresh an anchor. Re-reading the number is the act the marker records, so a date written by a pass that measured nothing is the false confidence the marker exists to prevent.
- Flag an unanchored entry. The standard scopes the rule forward, and an entry written before it is dated by blame rather than by a read.

The session amending a decision writes its anchor, which Step 3 already requires.

## Output

Output one line per finding:

`⚠ Anchor stale: "<decision name>" cites <path>, which this branch changed. Re-measure and refresh the anchor.`

If no anchored entry cites a changed path, skip silently. A record carrying no anchored entry produces no output on any branch, which is every project until a decision is written or amended under the rule.
