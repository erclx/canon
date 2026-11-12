---
title: Code health trend
description: How the trend section reads canon history against the repository's own past, and how a hotspot pairs with a long file
---

# Code health trend

The trend section sits under the per-file table. It reads `canon history --json` to show where the tree is moving, and it never adds an axis or a verdict. Each figure compares the repository with its own past, never with another project.

## The record

| Key        | Holds                                                                  |
| ---------- | ---------------------------------------------------------------------- |
| `window`   | `weeks`, `from`, and `to` of the span read                             |
| `coverage` | `merges`, `typed`, and `share`, the typed fraction of merges           |
| `weeks`    | Per week: `merges`, `types`, `fixShare`, `fixShareRolling`, and `size` |
| `hotspots` | `path`, `changes`, `lines`, `weight`, and `fixTouches`, heaviest first |

A hotspot's `weight` is its changes in the window times its current lines. `fixTouches` counts the fix merges that touched it. The verb's `--help` names how many hotspots it keeps and which paths it leaves out.

## What the section names

Name these in order, and skip any the record cannot answer.

1. **A long file among the hotspots.** A `longFiles` path that also appears in `hotspots` grows and changes at once, so it leads with its rank, `changes`, and `fixTouches`.
2. **A long function in a hotspot.** A `longFunctions` entry whose file is a hotspot, with the same figures.
3. **The other code hotspots.** The top few `hotspots` paths the code audit reads, skipping markdown, which `document-health` owns.
4. **Code size over the window.** The code extensions' `lines` from `size.byExtension` in the first and last week carrying a `size`. State both figures and the change.
5. **Fix share.** `fixShareRolling` in the first and last week, as a figure and never as a quality verdict.

## A narrowed scope

The verb takes a repository rather than a subtree, so a path argument still returns hotspots from the whole tree. Run it bare and keep only the hotspots inside the scope the run took. Its size figures cover the whole repository on any scope, so say so beside them.

## When a figure is missing

- `coverage.share` under half nulls the type figures, so leave fix share out and say why
- A week with no `size` was not sampled, so take the nearest week that carries one
- A refusal or a binary with no `history` subcommand leaves the section as `Trend unread: <cause>`

## Why no verdict

A rising fix share can mean more bugs or a team that started typing its fixes. Growth can be a feature landing. The section puts the figures beside the per-file findings so the operator reads them together, and the operator decides what they mean.
