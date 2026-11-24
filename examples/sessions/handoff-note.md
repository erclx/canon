---
title: Surge alert pushes expire at the advisory's effective time
description: Decided push expiry over a recall message, measured delivery lag on the staging push service, left the per-station batching open, 2026-03-13
category: Compact
session: 8f1e2a40-77c3-4b9d-a0e2-5c61d9b3f104
---

# Surge alert pushes expire at the advisory's effective time

Throwaway note for the next session on this branch. The plan at `.canon/plans/feature-surge-alerts.md` holds the scope.

## Where the work is

- `src/alerts/queue.ts` and its test carry the send path, and `bun test src/alerts` runs it
- `public/sw.js` shows the notification, and it has no test yet
- `src/stations/save-button.tsx` is untouched so far

## What was decided

- Expiry by time to live beat a recall message, since a recall needs per-push delivery state and the queue keeps none
- Push lag on staging measured a median of 6 seconds over 40 sends, against a 38 minute floor, so no retry logic was added

## What is open

1. A station with 40 followers sends 40 requests in one second. A batch call on the push service would settle it, and nobody has checked whether it offers one.
2. Not done on purpose: email delivery, which the groundwork decision dropped

## Where to pick up

Write the permission prompt on the first save in `src/stations/save-button.tsx`, with its component test first.

## Cautions

- `bun run feed:sample` prints an advisory with no `lifted` field, which the queue reads as active, so a lift test has to set the field itself
