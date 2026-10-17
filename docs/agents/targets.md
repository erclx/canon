---
title: Targets
description: The projects this toolkit installed into, where each answer comes from, and the cross-target pull request read
kind: reference
---

# Targets

`canon targets list` reports the projects this toolkit installed into, and `canon targets pulls [paths…]` reports each target's open pull requests, (all targets when none is named). Both take `--json`.

- `list` takes `--sweep <path…>`, `--depth <n>` (default 4), and `--record`, which seeds the index from each swept stamp and needs `--sweep`
- Each stamping sync records its target in `$XDG_STATE_HOME/canon/targets.json`
- A sweep finds installs the index never held, and nothing removes a row

## Output

- `bound` on a sweep names the roots walked, the depth, and what it skipped. Read it before treating a count as the population.
- Clones sharing an `origin` collapse to one row
- `legacyPaths` is the subset of `paths` still on the retired stamp path
- `pulls` reads one clone per project

| Field            | Holds                                                    |
| ---------------- | -------------------------------------------------------- |
| `checks`         | `passing`, `failing`, `pending`, or `null` when none ran |
| `review`         | `open`, `closed`, or `null` when no pass has landed      |
| `reviewReadable` | `false` when the review query failed                     |

## Refusals

Both exit 1 when refused. An absent index reports as unknown, not as no targets.

| Reason                 | Means                                        |
| ---------------------- | -------------------------------------------- |
| `bad-depth`            | `--depth` is not a whole number              |
| `record-without-sweep` | `--record` was given with no `--sweep`       |
| `not-a-directory`      | A named path is not a directory              |
| `gh-unavailable`       | `gh` is not on the path                      |
| `list-failed`          | The open pull request list could not be read |

The last three sit on a target's row.

## See also

- `install-and-sync.md`: the sync that stamps
