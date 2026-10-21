---
title: Targets
description: The projects this toolkit installed into, where each answer comes from, and the cross-target pull request read
kind: reference
---

# Targets

`canon targets list` reports the projects this toolkit installed into. `canon targets pulls [paths…]` reports each target's open pull requests, or every target's when none is named. Both take `--json`. Read the record's fields, since a wrapping shell function can flatten the exit.

- `list` takes `--sweep <path…>`, `--depth <n>` (default 4), and `--record`, which seeds the index from swept stamps and needs `--sweep`
- Each stamping sync records its target in `$XDG_STATE_HOME/canon/targets.json`, and no row is removed
- A sweep finds installs the index never held

`canon changelog` prints the releases a target has not seen, from the `CHANGELOG.md` the installed package ships. It reads no registry and needs no `gh`.

- The start defaults to the oldest `version` across the target's stamp domains. `--since <version>` overrides it, and `--root <path>` names the target.
- `--json` carries `since`, `running`, and `entries`, each with its `version` and raw `markdown`, oldest first
- A start equal to the running version is the one empty range, since that target is current
- A refusal names its `reason` instead of printing an empty range, being `no-stamp`, `no-changelog`, or `unknown-version`. The last covers a pre-release and a start newer than the binary.

## Output

- `bound` on a sweep names the roots walked, the depth, and what it skipped. Read it before trusting a count.
- Clones sharing an `origin` share a row, and `pulls` reads one
- `legacyPaths` is the `paths` on the retired stamp path

| Field            | Holds                                                    |
| ---------------- | -------------------------------------------------------- |
| `checks`         | `passing`, `failing`, `pending`, or `null` when none ran |
| `review`         | `open`, `closed`, or `null` when no pass has landed      |
| `reviewReadable` | `false` when the review query failed                     |

## Refusals

`list` exits 1 when refused. `pulls` exits 0 when one target was read and 1 when all refused. An absent index reads as unknown.

| Reason                 | Means                                   |
| ---------------------- | --------------------------------------- |
| `bad-depth`            | `--depth` is not a whole number         |
| `record-without-sweep` | `--record` with no `--sweep`            |
| `not-a-directory`      | A named path is no directory            |
| `gh-unavailable`       | `gh` is not on the path                 |
| `list-failed`          | The pull request list could not be read |

The last three fail only that target's row.
