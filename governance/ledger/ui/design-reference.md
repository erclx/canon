---
title: Design reference rule ledger
description: Sources for governance/rules/ui/design-reference.md, one row per bullet
---

# Design reference rule ledger

The rule states canon's own design handoff, generalized from Frameboard's project rule, so every row is a house choice naming the bug the bullet prevents.

## Where the design lives

| Bullet                         | Source                                                                                                                                                              | Read       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Build against the tracked copy | House choice: a canvas changes under the build with no history, so a reviewer cannot tell which version a surface was built against                                 | 2026-10-18 |
| Land a design first            | House choice: a design landing inside a feature pull request is reviewed as code, and a second feature building against it meanwhile reads a design nobody accepted | 2026-10-18 |
| No hand edits                  | House choice: a reference edited by hand drifts from its canvas source, and the next sync overwrites the edit or reports it as a change nobody made                 | 2026-10-18 |
| Index row before the sync      | House choice: the sync writes only the surfaces the index names, so a missing row drops the new surface's reference, and a stale row keeps a removed surface's      | 2026-10-18 |

## Building against a reference

| Bullet                     | Source                                                                                                                     | Read       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Open both themes first     | House choice: a build read from the dark image alone ships a light theme nobody saw                                        | 2026-10-18 |
| Values from the frame HTML | House choice: sizes and colors read off an image are estimates, and the frame HTML carries the exact values the design set | 2026-10-18 |

## Showing the comparison

| Bullet                             | Source                                                                                                                       | Read       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Reference beside capture           | House choice: a reviewer shown the build alone has nothing to compare it to, and approves a departure without seeing it      | 2026-10-18 |
| Name each departure                | House choice: an unnamed departure reads as an accident, and the next build against the same reference repeats or reverts it | 2026-10-18 |
| Unexplained departure is a finding | House choice: without the finding, an unexplained departure merges as the new design with no one having chosen it            | 2026-10-18 |

## Naming

| Bullet                  | Source                                                                                                                                 | Read       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| One folder per app part | House choice: a fixed folder and theme suffix let the sync and a reviewer find a surface's pair of references without reading an index | 2026-10-18 |

## Declined

The rewrite kept every bullet. Each was already under 200 characters and states a step a reviewer can check against the pull request.
