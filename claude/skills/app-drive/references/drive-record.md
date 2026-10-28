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
- **Drawn:** `evidence/02-options.png`, `evidence/mocks/layers/`
- **Decision (operator):** center the frame unless it is wholly visible
```

- `<nn>` numbers findings in the order they were found, and the frame carries the same number
- A drive frame is named `frames/<nn>-<name>.png`. A drawn frame is named `<nn>-now`, `<nn>-fix`, or `<nn>-fix-<variant>` by the log's finding number, for a bug fix and a new feature alike.
- The title names what the persona met, in sentence case with no trailing period
- The meta line holds the severity, the source, and the persona, in that order. The source is `goal`, `last-drive`, or `operator`, and a finding naming none sorts as taste.
- A `last-drive` finding adds `fixed`, `still open`, or `changed` to its meta line

### Setup rows

The setup table is written once, before the first finding, and every row stays even when its value is empty.

- `Commit`, `Copy`, and `Launch` come from making the copy, per `isolate.md`
- `Address` is the `url` that `canon pr local --root <worktree> --json` confirmed in Step 1
- `In flight` names each open branch or live plan holding a path the drive covers, as `canon:role-planner` reads what is in flight, and reads `none` when nothing is

### Fields

The fields under the meta line carry the drive itself, one fact to a line.

- `Saw` carries the number read off the page or the app when the claim has one, such as `scrollWidth 436 against clientWidth 320`
- `Cause` is optional, and says whether it was measured or read from code
- Write the operator's call as `Decision (operator)` under the finding it settles, even when it arrives after later findings
- A decision settling two findings sits under the first, and the second carries `Decision (operator):` naming that finding's number, such as `see 02`
- Keep each field to one line. A field that runs long splits into a second field rather than growing.

### Drawn outcomes

The check reads `Drawn` and `Decision (operator)` off the log by those exact labels, so a reworded label turns the check off without failing it.

- Put the options screenshot at `evidence/<nn>-options.png`, showing the now frame beside every fix frame
- Copy the mock source into `evidence/mocks/<surface>/`, where `<surface>` names the screen or panel drawn on
- Write `Drawn` above the decision, citing paths under `evidence/` the way `Evidence` does, or `skipped, <reason>` when the change has nothing visible
- A bare `skipped` with no reason counts as undrawn, since the next reader cannot tell a choice from an omission
- A decision reading `see <nn>` was drawn under the finding it names and carries no `Drawn` of its own

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
| `undrawn`         | a logged decision with no drawn outcome or reason  |
| `worktreeLeft`    | the `worktree` path still on disk                  |
