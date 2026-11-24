---
title: Alerts
description: Surge advisories from the tide service feed to the in-app banner and the push sent to a saved station's followers
---

# Alerts

## Overview

Owns surge advisories from the moment the tide service publishes one to the moment a person sees it, in the open app or as a push. Station data and tide heights belong to the tides domain, and this one reads them and never writes them.

## Layout

### `src/alerts/`

Polls the advisory feed, renders the banner, and queues one push per follower of an affected station.

- The feed record carries `issued`, `effective`, and `lifted`, and every reader treats a set `lifted` as gone
- Each push expires at the advisory's effective time, so a late delivery never arrives after the surge
- The send path reads `lifted` again just before it sends, since an advisory can lift while it waits in the queue

### `public/`

Holds the service worker that shows a push and opens the station on a tap.

- The worker opens `/stations/<id>` whether or not the station is still saved

### Other folders

- `src/stations/` owns saving a station and the one notification permission prompt that rides on the first save

## Gotchas

- A prompt dismissed with Escape leaves the permission at `default`, so the save button remembers the dismissal for the session
- The feed's sample command returns an advisory with no `lifted` field, which reads as active
