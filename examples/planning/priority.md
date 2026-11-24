---
title: Priority
description: Tidewell's execution order for the spring beta fixes and the surge alert work
---

# Priority

## In flight

| Task                                        | Touches                                | Session                   |
| ------------------------------------------- | -------------------------------------- | ------------------------- |
| [v03.2 surge-alerts](v03.2-surge-alerts.md) | 9 files under `src/alerts/`, `public/` | worker-c (opus, high)     |
| `v03.1-zone-labels.md`                      | 3 files under `src/tides/`             | worker-b (sonnet, medium) |

## Up next

| Task                       | Touches                     | Launch                             | Waiting on                                                     |
| -------------------------- | --------------------------- | ---------------------------------- | -------------------------------------------------------------- |
| `v03.3-advisory-banner.md` | 2 files under `src/alerts/` | worker, sonnet, medium, background | `v03.2-surge-alerts.md` holds `src/alerts/feed.ts`, a contract |

## Needs a plan

| Task                     | Waiting on                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `v03.4-week-chart.md`    | the drive's two decided items need a plan, and it leads the clock row as a shipped-layout defect |
| `v03.5-clock-setting.md` | a settings screen to hold the toggle, and it trails the week chart row as a requested feature    |
