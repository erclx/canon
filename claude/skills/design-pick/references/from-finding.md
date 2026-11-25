---
title: Pick from a finding
description: Which of app-drive and design-pick a request needs, and where a pick started from a drive finding or an intake item draws and writes its decision back
---

# Pick from a finding

Read by `design-pick` Step 1 when the ask names a drive finding or an intake item, and by `app-drive` when an ask holds nothing to test.

## Which skill

A drive tests a built app and records what it finds. A pick settles how something looks.

| The operator has                            | Runs                          |
| ------------------------------------------- | ----------------------------- |
| A concept or a new screen to sketch         | `design-pick` alone           |
| A built app to try                          | `app-drive` alone             |
| A drive finding nobody could decide         | `design-pick` on that finding |
| A concept whose behavior has to be measured | `plan-groundwork`             |

A drive draws and decides a finding inside its own project while its copy runs. A taste finding left undecided is logged undrawn, and its item takes `sketch` as its answer.

## Where the pick draws

- Draw in the drive's project, the one the drive log's `Board` row or the intake overview names, and start the board when neither was filled
- With neither filled, name the project the `board-project` of the `[drive]` table gives a drive, or `drive-<nn>` for a pass, and file it under `board-folder`
- Draw on the finding's topic page, or the item's, as `${CLAUDE_SKILL_DIR}/../design-pick/references/drawing.md` lays one out, the section as shipped first and one group per arm
- Add the section to `00-current` as shipped when that page lacks it, and write it to `00-next` as picked at every pick

## What the pick writes back

- Copy the options capture and each mock into the intake's `evidence/`, as `${CLAUDE_SKILL_DIR}/../app-drive/references/drive-record.md` states, and both pages' captures into `evidence/baseline/`
- Write `Drawn` and `Decision (operator)` under the finding in the drive log, filling the `Board` row when it was empty
- Add `Decided:` to the item and land it with `canon intake answer <slug> --cluster <file> --decided <label>`, which fills a `sketch` slot
- With no drive log, land the pick with `--set <label>=<pick>` in place of the two lines above
- Run the folder's checks again, `canon intake drive-check` only where a drive record sits in it

The check compares a checkout the pick has since changed, so fix only what the pick owns, being `undrawn`, `uncaptured`, `skippedVisible`, `strayEvidence`, and `missingEvidence`. Report every other list, and a `no-baseline` refusal, as it reads. Never run `--baseline` to clear one, since that erases what the drive was compared against.
