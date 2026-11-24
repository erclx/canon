---
title: Tide feedback from the spring beta
description: Beta feedback on surge advisories, tide times, and station search, filed by the domain each fix touches
date: 2026-03-02
---

# Tide feedback from the spring beta

Fourteen beta reports from the March cohort, sorted into items and measured against `a41c0e9`.

## The answer contract

`You:` ships empty and empty means unread. Accepting a verdict is typed as
`- **You:** ok`. Nothing here is decided by silence.

## Clusters

| File           | Holds                                           | Items | Open |
| -------------- | ----------------------------------------------- | ----- | ---- |
| `01-alerts.md` | Surge advisories, how late they land and where  | 3     | 1    |
| `02-times.md`  | How tide times read across time zones and modes | 2     | 0    |

## Verdicts

Four items are worth it now, one is worth it later, and none is declined.

## Ready

- Small: `02-times.md` item 1, label the zone beside each tide time
- Bundle advisory banner: `01-alerts.md` items 1 and 2, sharing `src/alerts/banner.tsx`, standing in for those items' own rows
- Later: `02-times.md` item 2, a 12-hour clock setting, once the settings screen exists

## Open questions

1. [How should a surge advisory reach someone with the app closed?](01-alerts.md#3-advisories-reach-nobody-with-the-app-closed)
