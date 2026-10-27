---
title: Tick the passed boxes
description: Step 8 of review-ui, which ticks each box that passed through canon pr tick once the verdict has posted, and reports an owed re-drive or a stale head instead of retrying
---

# Tick the passed boxes

Step 8 of `review-ui`. The verdict has posted, so the ticks and the verdict name the same `<head>`.

Tick every box that took a `pass` verdict at this head, whatever the heading, so a partly passed checklist shows its progress. A re-drive ticks all of them again, including a box whose verdict did not change, since a new head clears the ticks stamped at an older one.

```bash
canon pr tick <number> --boxes <n,...> --head <head> --json
```

Number the boxes off the `boxes` field Step 2 kept. Leave a box that failed, needs eyes, or was not driven empty.

## When the tip moved

A push that landed while this pass drove carries the ticks to the tip when it changed only paths no box observes, being tests, stories, snapshots, markdown, evidence captures, and `canon/design/`. The record then reads `ticked` with the head it came from in `carriedFrom`.

The verb refuses a taste box and a head the tip moved past in any other way, writing nothing in either case. Branch on the record's `reason`.

- `count-mismatch`: nothing was written. With `ticked` below `passed`, re-run once with every passed box. With it above, a box ticked earlier has failed, so report it on `Ticks:` for the operator.
- `redrive-owed`: a push since `<head>` changed a path a box can observe. Report `driven`, `head`, and `drivenPaths` on the `Ticks:` line of Step 10, and never retry at the tip.
- `stale-head`: the driven head was rewritten away, by a force-push or a rebase, or the gap could not be read. Report it on the `Ticks:` line and never retry at the new tip.
- `body-refused`: the comment is ticked and the body is not. Retry the same call once, then report the partial result on the `Ticks:` line rather than claiming both.
- Any other refusal: report the `reason` on the `Ticks:` line and tick nothing further.

A binary whose `canon pr` lacks `tick` predates the verb. Report that on the `Ticks:` line and tick nothing.

## What a tick reports

The record's `countCheck` reads `matched` when the verdict's passed count agreed with the ticks, and `unchecked` when the verdict covered neither the tip nor the head a carry came from, or carried no count line. Report an `unchecked` on the `Ticks:` line.

The same call also writes the one UI pass line in the body's `## Testing`, such as `UI pass, 17 of 17 boxes passed at <sha>, 1 taste box left to the operator`, so the operator sees the result without opening the evidence comment. Never edit that line by hand.
