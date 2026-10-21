---
title: Design reference rule ledger
description: Sources for governance/rules/ui/design-reference.md, one row per bullet
---

# Design reference rule ledger

The rule states canon's own design handoff, generalized from Frameboard's project rule, so every row is a house choice naming the bug the bullet prevents.

## Where the design lives

| Bullet                         | Source                                                                                                                                                            | Read       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Build against the tracked copy | House choice: a canvas changes under the build with no history, so a reviewer cannot tell which version a surface was built against                               | 2026-10-18 |
| Load the keeper skill          | House choice: the rule governs an edit and carries no procedure, so a session without the skill copies frames in by hand or skips the index row                   | 2026-10-21 |
| Land a design with its build   | House choice: a design merged as its own pull request waits on a review that reads a picture with no build beside it, and the pick drifts before anything uses it | 2026-10-21 |
| No hand edits                  | House choice: a reference edited by hand drifts from its canvas source, and the next sync overwrites the edit or reports it as a change nobody made               | 2026-10-18 |
| Index row before the sync      | House choice: the sync writes only the surfaces the index names, so a missing row drops the new surface's reference                                               | 2026-10-21 |
| Reference lifetime             | House choice: a reference kept past its surface misleads the next build, and one redrawn without a design change hides a departure the review should see          | 2026-10-21 |

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

## Declined

The rewrite kept every bullet. Each was already under 200 characters and states a step a reviewer can check against the pull request.
