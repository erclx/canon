---
title: Drift report
description: What canon sync --check reports, being the drift states, the eight side sections no sync applies, and version skew
---

# Drift report

What `canon sync --check` reports and which states fail CI. `canon docs install-and-sync` covers what each sync verb writes.

## Drift report

`canon sync --check` writes nothing and needs no clean tree. `--json` emits the record, `--exit-code` fails CI.

| State        | Meaning                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| `stale`      | Still matches what the toolkit installed                                |
| `customized` | The project edited it                                                   |
| `stranded`   | Sits at a path the toolkit no longer installs to                        |
| `orphaned`   | The project authored it                                                 |
| `drifted`    | No stamp covers it                                                      |
| `missing`    | Governance only. The recorded stack lists it, or a split rule leaves it |
| `retired`    | Governance only. The toolkit no longer ships it                         |
| `renamed`    | Governance only. The toolkit ships it under a new name                  |

`retired` and `renamed` count toward `--exit-code`. `orphaned` and `missing` do not.

- Attribution reads `canon/config/config.json`, then `.claude/canon/config.json`, then the retired `.claude/canon.json`, and moves none
- With none it matches the toolkit's git history, where a published version is `stale` and anything else `drifted`. A registry install has none and reports `historyUnavailable`.
- `covers` names the domains the target stamped, and each domain keeps its own anchor
- Tooling records its stack chain, nearest first, and never counts toward `--exit-code`
- `tooling.measured: false` means none was recorded. It clears on the next `canon tooling sync`. A workspace root records nothing, so run the check against a package.

## Side sections

Eight sections sit outside the per-domain scan, and no sync applies them. Each returns empty when `managed` is false. A managed target holds `.claude/`, a `CLAUDE.md`, or a root-layout domain, and an unmanaged one is routed to `canon init`.

| Section           | Reports                                                                                 | Exit |
| ----------------- | --------------------------------------------------------------------------------------- | ---- |
| `seeds`           | Each seed as `matching`, `stale`, `drifted`, or `missing`. Merge an edited one by hand. | No   |
| `superseded`      | A file a newer seed folder replaced, as `replacedBy`. Never deleted.                    | No   |
| `unmigrated`      | A domain at its old root, with `rootPath`, `installPath`, and a count                   | Yes  |
| `unmovedSurfaces` | A surface at its `.claude/` spelling, as `rel` and `movesTo`                            | No   |
| `newRules`        | A rule the recorded stack lists and the tree lacks                                      | No   |
| `newSkills`       | A plugin skill the target has not seen. Needs no command.                               | No   |
| `reverse`         | `unclaimed` folders the toolkit once shipped                                            | No   |
| `hooks`           | A seeded hook whose script the target holds and `settings.json` never runs              | Yes  |

The Exit column marks what counts toward `--exit-code`, an `unreadable` hooks state included. `canon migrate surface-roots` closes `unmovedSurfaces`, `canon gov install` closes `newRules`, and `canon migrate session-defaults --write` closes `hooks`. A `reverse` entry is attributed `dropped`, `project`, or `unattributed`.

`newRules` and `newSkills` come back empty on a shallow clone or registry install, which is unmeasured rather than clean.

## Version skew

`canon sync --check` and `canon claude skills drift` report the installed version against the newest published one in `skew.state`. The report never changes an exit code, so branch on the field.

| State     | Meaning                                              |
| --------- | ---------------------------------------------------- |
| `behind`  | Names `canon upgrade` as the remedy                  |
| `current` | Installed matches published                          |
| `unknown` | Carries the reason the registry could not be reached |

`canon upgrade --json` adds `pending`, where the checkout holds a release npm does not serve yet. `checkout` names it, `message` starts `CLI stays at`, and the exit is 0.
