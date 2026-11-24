---
title: Surge alert delivery options
description: Push, email, and background polling compared on delivery lag and build cost
---

# Surge alert delivery options

Three ways to reach a closed app, each measured against the 38 minute floor from `01-current-state.md`.

### Push notification

Forty test pushes over two days landed with a median lag of 6 seconds and a worst case of 71 seconds. [RFC 8030](https://www.rfc-editor.org/rfc/rfc8030) lets the sender set a time to live, so an advisory lifted before delivery can expire unseen. It costs a service worker and a send queue.

### Email

Twenty test emails landed with a median lag of 3 minutes and a worst case of 22. Every tester already gave an address, but nine of fourteen said they read mail on a desktop, away from the shore.

### Background polling

A periodic background sync fires at the browser's discretion. In the test week the longest gap was 11 hours, which misses every advisory in the log.

## Open questions

1. Is push fast enough?
   - **Leaning:** yes, a 71 second worst case sits far under 38 minutes
   - **Overturned by:** a worst case past 38 minutes across a full month
2. Does email earn a place beside push?
   - **Leaning:** no, the people it reaches are away from the water
   - **Overturned by:** a tester group that reads mail on a phone at the shore
