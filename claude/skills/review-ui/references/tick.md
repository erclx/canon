---
title: Tick the passed boxes
description: Step 8 of review-ui, which ticks each box that passed through canon pr tick once the verdict has posted, and reports a stale head instead of retrying
---

# Tick the passed boxes

Step 8 of `review-ui`. The verdict has posted, so the ticks and the verdict name the same `<head>`.

Tick every box that took a `pass` verdict, whatever the heading, so a partly passed checklist shows its progress:

```bash
canon pr tick <number> --boxes <n,...> --head <head> --json
```

Number the boxes off the `boxes` field Step 2 kept. Leave a box that failed, needs eyes, or was not driven empty.

The verb refuses a taste box and a head that is no longer the remote tip, writing nothing in either case. Branch on the record's `reason`, which reads `ticked` on success.

- `stale-head`: a push landed while this pass drove. Report it on the `Ticks:` line of Step 10 and never retry at the new tip, since the boxes were driven at the old one.
- Any other refusal: report the `reason` on the `Ticks:` line and tick nothing further.
- A binary whose `canon pr` lacks `tick` predates the verb. Report that on the `Ticks:` line and tick nothing.
