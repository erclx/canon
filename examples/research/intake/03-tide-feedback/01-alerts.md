---
title: Surge advisories
description: Items on how late a surge advisory lands, where it sits, and who it reaches
---

# Surge advisories

Three reports agree that an advisory is easy to miss, and they split on why.

### 1. The advisory banner sits below the fold on a phone

- **Problem:** at 390 pixels wide the banner renders 712 pixels down, under the week chart, in `src/alerts/banner.tsx`
- **Fix:** render the banner above the chart in `src/alerts/banner.tsx` whenever an advisory is active
- **Worth it:** yes, five of fourteen reports name a missed advisory and every one was on a phone
- **Drawn:** `evidence/alerts/01-options.png`
- **You:**

### 2. A lifted advisory keeps its banner until a reload

- **Problem:** the banner in `src/alerts/banner.tsx` reads the advisory once at mount, so a lift at 14:05 still showed at 14:40 in a held session
- **Fix:** subscribe the banner in `src/alerts/banner.tsx` to the advisory feed it already polls
- **Worth it:** yes, a stale advisory teaches people to ignore the next one
- **Drawn:** `evidence/alerts/02-options.png`
- **You:**

### 3. Advisories reach nobody with the app closed

- **Problem:** `src/alerts/poll.ts` polls only while a tab is open, and nine of fourteen testers check the app under once a day
- **Fix:** deliver a surge advisory by push notification to people who saved the station
- **Worth it:** yes, and it needs measuring before anyone plans it, since the feed's update rate decides the design
- **Open:** whether a closed app hears about a surge by push, by email, or not at all
- **Suggested:** push for saved stations, since every tester already grants location and the reports ask for a phone alert. The cost is a service worker and a send queue.
- **You:**
