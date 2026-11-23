---
title: Round widths reference ledger
description: Sources for claude/skills/design-pick/references/widths.md, the usage shares and the WCAG Reflow passage the 390, 768, and 1280 fallback and the 320 check rest on
---

# Round widths reference ledger

The field is responsive layout. StatCounter carries the usage shares, read as page views on its sample sites rather than a device census. WCAG carries the reflow floor, and Material 3 carries the layout class split. The operator picked the set from three candidates weighed against these sources on 2026-11-23.

## Picking the widths

Each fallback width is a ranked viewport at the narrow end of its class, so a frame drawn there shows the cramped case.

| Bullet       | Source                                                                                                                                                                                                                                                                | Read       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Phone 390    | [StatCounter mobile, worldwide](https://gs.statcounter.com/screen-resolution-stats/mobile/worldwide): October 2026 ranks 414x896 at 12.67%, 360x800 at 8.57%, 384x832 at 7.24%, 390x844 at 5.33%, and 393x873 at 4.43%, so 390 sits inside the band its top five hold | 2026-11-23 |
| Tablet 768   | [StatCounter tablet, worldwide](https://gs.statcounter.com/screen-resolution-stats/tablet/worldwide): October 2026 ranks 1280x800 at 7.96%, 800x1280 at 7.89%, then 768x1024 at 7.39%, with 834 absent from its top six                                               | 2026-11-23 |
| Tablet class | [Material 3, applying layout](https://m3.material.io/foundations/layout/applying-layout): compact under 600, medium from 600 to 839, and expanded from 840, so 768 draws the medium layout                                                                            | 2026-11-23 |
| Desktop 1280 | [StatCounter desktop, worldwide](https://gs.statcounter.com/screen-resolution-stats/desktop/worldwide): October 2026 ranks 1920x1080 at 27.82%, 1536x864 at 9.13%, 800x600 at 8.85%, 1366x768 at 7.48%, and 1280x720 at 4.44%, with 1440 absent from its top six      | 2026-11-23 |

## The 320 check

The floor is held by a measurement rather than a frame, since nothing fails on a picture.

| Bullet                       | Source                                                                                                                                                                                                       | Read       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 320 is the reflow floor      | [WCAG 2.2 Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): content reflows at a width of 320 CSS pixels without scrolling in two dimensions                                   | 2026-11-23 |
| 1280 reaches 320 when zoomed | [WCAG 2.2 Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): 320 CSS pixels "generally corresponds to a desktop browser window set to a width of 1280px" zoomed to 400%         | 2026-11-23 |
| No sideways scroll at 320    | [WCAG 2.2 Success Criterion 1.4.10](https://www.w3.org/TR/WCAG22/#reflow): content is presented without loss of information or functionality and without requiring scrolling in two dimensions at that width | 2026-11-23 |

## Considered and dropped

Two other sets were weighed against the same sources.

- 390, 834, and 1440, the earlier draw set, where 834 and 1440 rank in no usage table above
- 390, 820, and 1366, the most common device per class, which hides the cramped narrow end, and 1366 has no tie to the reflow floor
