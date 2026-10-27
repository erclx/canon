---
title: Drive record
description: The drive log, the severity scale, the finding sources, and the drive.json shape that canon intake drive-check reads
---

# Drive record

Read before the first finding of `app-drive`. A drive leaves two records in its intake folder, being a log a person reads and `drive.json`, which the check reads.

## The drive log

Write the log to `evidence/drive-log.md` inside the intake folder. It opens on a setup table, then takes one heading per finding, appended as the finding happens.

```markdown
# Drive log

| Setup     | Value                                             |
| --------- | ------------------------------------------------- |
| Commit    | `v0.13.138`                                       |
| Copy      | `/tmp/tmp.Xy12/app`                               |
| Launch    | `bun install && bun run build && bun run preview` |
| Address   | `http://127.0.0.1:4530`                           |
| In flight | `feat/landing-page` holds `web/`                  |

## 02. Layers click leaves a half-hidden frame in place

`minor` · operator · developer

- **Did:** clicked the frame in Layers
- **Saw:** the view stayed put, with 64% of the frame under the panel edge
- **Cause:** from code, the reveal acts only when the box is wholly outside the view
- **Evidence:** `evidence/02-partial-no-pan.png`
- **Decision (operator):** center the frame unless it is wholly visible
```

- `<nn>` numbers findings in the order they were found, and the frame carries the same number
- The title names what the persona met, in sentence case with no trailing period
- The meta line holds the severity, the source, and the persona, in that order. The source is `goal`, `last-drive`, or `operator`, and a finding naming none sorts as taste.
- A `last-drive` finding adds `fixed`, `still open`, or `changed` to its meta line

### Fields

The fields under the meta line carry the drive itself, one fact to a line.

- `Saw` carries the number read off the page or the app when the claim has one, such as `scrollWidth 436 against clientWidth 320`
- `Cause` is optional, and says whether it was measured or read from code
- Write the operator's call as `Decision (operator)` under the finding it settles, even when it arrives after later findings
- Keep each field to one line. A field that runs long splits into a second field rather than growing.

### Passed goals

A goal tried and passed takes a heading too, so the next drive can tell a goal checked from one skipped. Its meta line reads `pass` · goal · persona, and it carries `Did` and `Evidence` alone.

### Operator images

Operator images count as evidence on arrival. One showing a finding takes that finding's number and is cited from its `Evidence` field. One no finding cites yet is a reference shot with a heading of its own.

```markdown
## ref-01. The operator's Figma typography panel

- **Evidence:** `evidence/ref-01-figma-typography.png`
```

- `ref-<nn>` numbers reference shots apart from findings, so a later finding citing one keeps the path it already has
- Keep the pasted file's own extension when it is not a PNG

## Severity

Each finding takes one level, judged by what the persona loses.

| Level     | The persona                                         |
| --------- | --------------------------------------------------- |
| `blocker` | cannot finish the goal at all                       |
| `major`   | finishes it only by a workaround they would not try |
| `minor`   | finishes it, with friction they notice              |
| `polish`  | finishes it, and only a close look shows the flaw   |

## `drive.json`

Write it to the intake folder root before the close. `canon intake drive-check` reads it, and ignores any field it does not name.

```json
{
  "goals": [
    { "goal": "A designer lays out frames on one board", "status": "driven" },
    {
      "goal": "A board exports to PNG",
      "status": "not-driven",
      "reason": "export needs a signed build"
    }
  ],
  "evidence": ["evidence/01-board.png"],
  "worktree": "/tmp/tmp.Xy12/app"
}
```

- `goals` holds one entry per `## Goals` bullet, with the bullet's text. A bold label and a trailing period may stay or go, since the check strips both.
- `status` is `driven` or `not-driven`, and a `not-driven` entry carries the `reason` the goal could not be reached
- `evidence` lists every frame a finding cites and every image the operator pasted, reference shots included, each a path under `evidence/` relative to the intake folder
- `worktree` is the throwaway worktree's path, which the check fails on while it still exists

### What the check fails

A failed check names each finding by list, and an empty list is a clean axis.

| List              | Fails on                                           |
| ----------------- | -------------------------------------------------- |
| `unmapped`        | a goal with no entry                               |
| `unreasoned`      | a `not-driven` goal with no reason                 |
| `unknown`         | an entry naming no goal the requirements hold      |
| `changed`         | a main checkout path that moved since the baseline |
| `strayEvidence`   | an evidence path outside `evidence/`               |
| `missingEvidence` | an evidence path holding no file                   |
| `worktreeLeft`    | the `worktree` path still on disk                  |
