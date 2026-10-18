---
title: Surface capture rule ledger
description: Sources for governance/rules/ui/surface-capture.md, one row per bullet
---

# Surface capture rule ledger

The rule states canon's own evidence procedure for a rendered change, so most rows are house choices naming the bug the bullet prevents. The 320 floor rests on WCAG 2.2, and each explanation the old rule carried moved into a row here.

## What a surface is

| Bullet                         | Source                                                                                                                                    | Read       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Generated pages are surfaces   | House choice: reading a generated page's markup reports nothing about how it composes, so a page nobody captured ships its layout unseen  | 2026-10-18 |
| Skip build-stripped components | House choice: the production build removes a dev-only switcher before anything renders, so a capture of it compares nothing a person sees | 2026-10-18 |

## When to capture

| Bullet                  | Source                                                                                                                                                           | Read       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Preview, not dev server | House choice: a dev server injects overlays and skips the production build's transforms, so its frame differs from what ships                                    | 2026-10-18 |
| Every theme, and again  | House choice: a defect in the dark theme passes a light-only capture, and a repair inside a shared stylesheet can cancel a rule written earlier in the same file | 2026-10-18 |

## What a capture covers

| Bullet                      | Source                                                                                                                                                                                                                                        | Read                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Full page                   | House choice: a component captured alone shows none of the spacing, overflow, or stacking its page imposes on it                                                                                                                              | 2026-10-18           |
| 320 plus breakpoints        | [Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): the criterion tests "a width equivalent to 320 CSS pixels". A 320 frame proves a frame was taken there, never that the page reflows, which `a11y.md` states. | 2026-10-18, WCAG 2.2 |
| Chrome at both clamps       | House choice: a sidebar widened to its clamp leaves the content under the floor at a window width the criterion passes, and a frame where the chrome turned into an overlay shows none of the width it takes                                  | 2026-10-18           |
| State case at one width     | House choice: a case driving a menu open tests the state, and repeating it at every layout width multiplies the evidence with no layout to compare                                                                                            | 2026-10-18           |
| Drive unreachable states    | House choice: an initial render reports nothing about a menu that opens, an answer that is chosen, or a rail that tracks scrolling                                                                                                            | 2026-10-18           |
| Case lives with the surface | House choice: a surface with no case ships uncaptured, and a case left after its surface goes fails every later capture run                                                                                                                   | 2026-10-18           |

## Sharing a capture

| Bullet                    | Source                                                                                                                                                                                                        | Read       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| An `evidence` folder      | House choice: the pull request comment collects an image only when a path segment is literally `evidence`, so any other name drops the capture. Several such folders, one per surface, is the ordinary shape. | 2026-10-18 |
| Commit flagged cases only | House choice: recommitting an unbounded sweep on every run reaches a gigabyte of history inside a hundred merges, while a small committed set lets GitHub draw its own before and after comparison            | 2026-10-18 |
| Byte-identical twice      | House choice: a case whose output varies between runs shows a diff on every pull request, so the comparison stops meaning a change                                                                            | 2026-10-18 |
| Mask the moving value     | House choice: an elapsed-time counter or a relative date differs on every run, and masking the smallest element keeps the check running on the rest of the frame                                              | 2026-10-18 |
| Name the variance         | House choice: a value whose width reflows its neighbors survives the mask, and re-running until two frames match hides the variance rather than removing it                                                   | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Moved into a row as the reason

- Moved "judge a generated page by the same rule as a route, since reading its markup reports nothing" into the generated pages row.
- Moved "read a capture at 320 as proof that a frame was taken there, not that the page reflows" into the 320 row.
- Moved "several `evidence/` folders in one project is the ordinary shape" into the folder row.
- Moved "recommitting an unbounded sweep reaches a gigabyte of repository history" into the commit row.
- Moved "do not commit the state as evidence when the masked outputs still differ" into the variance bullet and its row.

### Cut as stated elsewhere

- Cut "`git-pr` and `git-followup` maintain a comparison comment automatically", which those skills own and which directs nothing at the edit.
- Cut "fall back to the 320 floor alone when the project has no `DESIGN.md`", merged into the 320 bullet's "or at 320 alone".
- Cut "read those bounds from the code that clamps the chrome", merged into the chrome bullet's "clamp".
- Cut "do not impose another project's breakpoints", which the bullet reading `## Layout` already prevents.

### Merged or reworded

- Merged "run the capture command", "against a running preview", "every theme", and "capture again" into two bullets.
- Merged "do not commit the sweep" with "commit a flagged case's evidence" and the established convention exception.
- Merged "add a case" and "remove a surface's case" into one bullet.
- Shortened every bullet past 200 characters, cutting the rule from 27 bullets and 840 words to 15 and under 300.
