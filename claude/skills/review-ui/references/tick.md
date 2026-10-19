---
title: Tick the passed boxes
description: Step 8 of review-ui, which ticks each box that passed through canon pr tick once the verdict has posted, and reports a stale head instead of retrying
---

# Tick the passed boxes

Step 8 of `review-ui`. The verdict has posted, so the ticks and the verdict name the same `<head>`.

Tick every box that took a `pass` verdict at this head, whatever the heading, so a partly passed checklist shows its progress. A re-drive ticks all of them again, including a box whose verdict did not change, since a new head clears the ticks stamped at an older one.

```bash
canon pr tick <number> --boxes <n,...> --head <head> --json
```

Number the boxes off the `boxes` field Step 2 kept. Leave a box that failed, needs eyes, or was not driven empty.

The verb refuses a taste box and a head that is no longer the remote tip, writing nothing in either case. Branch on the record's `reason`, which reads `ticked` on success.

- `count-mismatch`: nothing was written. With `ticked` below `passed`, re-run once with every passed box. With it above, a box ticked earlier has failed, so report it on `Ticks:` for the operator.
- `stale-head`: a push landed while this pass drove. Report it on the `Ticks:` line of Step 10 and never retry at the new tip, since the boxes were driven at the old one.
- `body-refused`: the comment is ticked and the body is not. Retry the same call once, then report the partial result on the `Ticks:` line rather than claiming both.
- Any other refusal: report the `reason` on the `Ticks:` line and tick nothing further.
- A binary whose `canon pr` lacks `tick` predates the verb. Report that on the `Ticks:` line and tick nothing.

The record's `countCheck` reads `matched` when the verdict's passed count agreed with the ticks, and `unchecked` when the verdict did not cover the head or carried no count line. Report an `unchecked` on the `Ticks:` line.

The same call also writes the one UI pass line in the body's `## Testing`, such as `UI pass, 17 of 17 boxes passed at <sha>, 1 taste box left to the operator`, so the operator sees the result without opening the evidence comment. Never edit that line by hand.
