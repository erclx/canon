---
title: Waive the undriven boxes
description: The Waived undriven line a closing UI review carries when a box was not driven, the count canon pr lift matches, and when a pass writes it
---

# Waive the undriven boxes

Part of Step 7 of `review-ui`, reached when a pass closes with any box not driven. `canon pr lift` refuses that close as `ui-undriven` unless the body waives every undriven box, so a skipped box reaches the merge only on a reason this pass wrote.

## The line

Put one line last under Not driven, outside any fence:

```markdown
- **Waived undriven:** <N>: <reason>
```

- `<N>` is the count line's not driven count as bare digits, covering every undriven box at once, since the lift matches that number alone
- Never split the count across two lines or name a box by its number, since boxes renumber when the checklist is edited
- The reason names each cause off the page in a few words, such as ``two `(local only)` boxes on a hosted preview``, under the limits `post.md` sets
- A loopback address it names reads as a local preview with its port, per `post.md`

## When to write it

Write it once `post.md` has settled the heading as closed, with the box's own cause already in its Not driven entry.

- A pass under `## UI review` carries no waiver, since the open heading holds the mark on its own
- A pass that drove no box takes none either, since the lift refuses that close whatever it waives
- A box blocked by a read-only start state is never waived, since `driving.md` retries it and counts what stays blocked as a cause on the page
- A rewrite under `close-out.md` counts again, since the lift reads the waiver off the newest verdict's own body and a stale count no longer matches

## A close that does not cover the head

A close at the current head covers it only when its count line shows no box not driven, or it drove a box and one line in its body carries that count. Drive the checklist again otherwise, and post the new verdict as its own review, since `close-out.md` replaces only a close at an older head.
