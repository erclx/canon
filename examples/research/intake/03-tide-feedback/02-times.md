---
title: Tide times
description: Items on how tide times read across time zones and clock formats
---

# Tide times

Two reports misread a tide time, each for a different reason.

### 1. A tide time names no time zone

- **Problem:** a tester in Lisbon read the Cascais high at 07:12 as local while it showed station time, and `src/tides/format.ts` prints no zone
- **Fix:** print the station's zone abbreviation beside each time in `src/tides/format.ts`
- **Worth it:** yes, one wrong reading sends someone out on a rising tide
- **You:**

### 2. No 12-hour clock

- **Problem:** two testers asked for a 12-hour clock, and `src/tides/format.ts` hard-codes 24-hour output
- **Fix:** add a clock setting read by `src/tides/format.ts`
- **Worth it:** later, since the app has no settings screen to hold it yet
- **You:**
