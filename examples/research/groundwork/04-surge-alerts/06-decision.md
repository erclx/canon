---
title: Surge alerts for a closed app decision
description: Push notifications for saved stations, sent from a queue that drops a lifted advisory
---

# Surge alerts for a closed app decision

## Problem and goal

A surge advisory reaches only an open tab, and most testers keep the app closed. Done means a person who saved a station hears about a surge advisory before it takes effect, with the app closed.

## What to do

1. Add a service worker that shows a push notification for a surge advisory on a saved station
2. Send each advisory change from a queue that sets a time to live at the advisory's effective time
3. Ask for notification permission when someone saves their first station, never on first launch

## Considered and dropped

### Email

It lands inside the floor, but the people it reaches read it at a desk. Revive it if a tester group reads mail at the shore.

### Background polling

The browser decides when it runs, and an 11 hour gap misses every advisory. Revive it only if a browser commits to a sync interval.

## Revisit when

- **Overturned by:** a worst case past 38 minutes across a full month
