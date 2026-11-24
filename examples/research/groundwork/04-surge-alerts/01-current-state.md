---
title: Surge alerts current state
description: How advisories arrive today and how often the advisory feed updates, measured against a41c0e9
---

# Surge alerts current state

Every number here was taken on 2026-03-04 against `a41c0e9`.

### How an advisory reaches the page

`src/alerts/poll.ts` fetches the advisory feed every 300 seconds while a tab is open, and stops when the tab closes. No code path runs with the app closed, so a closed app hears nothing.

### How often the feed moves

Over seven days the feed published 41 advisory changes across the 12 saved Portuguese stations. The median gap from an advisory's issue time to its effective time was 94 minutes, and the shortest was 38.

### What that window allows

A delivery that lands inside 38 minutes reaches every advisory before it takes effect. Polling at 300 seconds does that for an open tab, and does nothing for a closed one.

## Open questions

1. Can a push land inside the 38 minute floor?
   - **Leaning:** yes, see `02-delivery-options.md`
   - **Overturned by:** a push gateway queueing a message past 38 minutes in the test week
