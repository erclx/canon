---
title: Surge alerts for a closed app
description: How a surge advisory reaches someone who saved a station while the app is closed
date: 2026-03-04
---

# Surge alerts for a closed app

Groundwork phase. Nothing here is a feature plan.

Measures whether a push notification can carry a surge advisory to a saved station's followers inside the window the advisory matters.

## Origin

- Intake: `03-tide-feedback/01-alerts.md` item 3

## Why

Nine of fourteen beta testers open the app under once a day, so an advisory that only shows in an open tab reaches almost none of them. The answer decides whether the next plan builds a send queue or a banner fix alone.

## Files

| File                     | Holds                                              |
| ------------------------ | -------------------------------------------------- |
| `01-current-state.md`    | How advisories arrive and how often the feed moves |
| `02-delivery-options.md` | Push, email, and polling compared on lag and cost  |
| `06-decision.md`         | Push for saved stations, behind a send queue       |

## Method

Internal sources were `src/alerts/poll.ts`, the feed client, and a week of the feed's own update log. The one external source read was the Web Push protocol, [RFC 8030](https://www.rfc-editor.org/rfc/rfc8030), for the delivery and expiry semantics. Nothing is left undone.

### Leads

- Browser vendor pages on notification permission rates, found and not opened

## Prior art

### The banner-only sketch

A sketch in the beta channel proposed a louder banner and nothing more. This track supersedes it, since a banner reaches only an open tab. Do not go looking for it.

## Source citation

Every claim about a source outside the project carries a link. A source found
and not read is listed as a lead and is never cited.
