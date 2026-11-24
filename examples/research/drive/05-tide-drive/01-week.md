---
title: Week chart
description: Items from the drive on the week chart's current tide marker and its reflow at 320 pixels
---

# Week chart

Both findings sit in one component, so they ship together.

### 1. The current tide marker hides behind the day list at 320 pixels

- **Problem:** at 320 pixels the marker in `src/tides/week-chart.tsx` draws at x 298 under the 40 pixel day list, finding 02 in the drive log
- **Fix:** clamp the marker inside the chart's own box in `src/tides/week-chart.tsx`
- **Worth it:** yes, the marker is the one number the page exists to show
- **Decided:** evidence/drive-log.md, finding 02
- **You:**

### 2. The chart scrolls sideways at the reflow floor

- **Problem:** at 320 pixels `src/tides/week-chart.tsx` reports scrollWidth 436 against clientWidth 320, finding 03 in the drive log
- **Fix:** let the day list scroll and hold the chart at its 20rem floor in `src/tides/week-chart.tsx`
- **Worth it:** yes, the design record already says the day list scrolls and never the chart
- **Decided:** evidence/drive-log.md, finding 03
- **You:**
