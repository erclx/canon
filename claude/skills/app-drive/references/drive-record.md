---
title: Drive record
description: The drive log, the severity scale, the finding sources, and the drive.json shape that canon intake drive-check reads
---

# Drive record

Read before the first finding of `app-drive`. A drive leaves two records in its intake folder, being a log a person reads and `drive.json`, which the check reads.

## The drive log

Write the log to `evidence/drive-log.md` inside the intake folder. It opens on its title, a length marker, and a setup table, then takes one heading per finding, appended as the finding happens.

```markdown
# Drive log

<!-- canon-length-exempt: a drive log is one record appended per finding, read top to bottom -->

| Setup     | Value                                             |
| --------- | ------------------------------------------------- |
| Commit    | `v0.13.138`                                       |
| Copy      | `/tmp/tmp.Xy12/app`                               |
| Launch    | `bun install && bun run build && bun run preview` |
| Address   | `http://127.0.0.1:4530`                           |
| Board     | `http://127.0.0.1:4173`, project `drive-13`       |
| In flight | `feat/landing-page` holds `web/`                  |

## 02. Layers click leaves a half-hidden frame in place

`minor` · operator · developer

- **Did:** clicked the frame in Layers
- **Saw:** the view stayed put, with 64% of the frame under the panel edge
- **Cause:** from code, the reveal acts only when the box is wholly outside the view
- **Evidence:** `evidence/layers/02-partial-no-pan.png`
- **Drawn:** `evidence/layers/02-options.png`, `evidence/mocks/layers/`
- **Decision (operator):** center the frame unless it is wholly visible
```

- `<nn>` numbers findings in the order they were found, and the frame carries the same number
- A screenshot is `frames/<nn>-<name>.png`, moved under `evidence/<surface>/` once cited. A drawn frame takes the drawing guide's name, such as `<section>-<arm>-<px>`.
- The title names what the persona met, in sentence case with no trailing period
- The meta line holds the severity, the source, and the persona, in that order. The source is `script`, `goal`, `last-drive`, `behavior`, or `operator`, and a finding naming none sorts as taste.
- A `last-drive` finding adds `fixed`, `still open`, or `changed` to its meta line

### A finding after the close

A finding raised after the close, in the same session and on the build just driven, appends to this log rather than opening another.

- Give it the log's next number, since the numbers are one sequence
- State in `Saw` whether it was measured on the live app or read from code, since the copy is gone
- Rebuild no copy for it, since a second build is a second drive with a folder of its own
- Send the controller the finding's number, kind, and intake item once both checks pass, since it may already have filed the drive's rows

### The length marker

A drive of any length runs past the markdown ceiling of 300 rendered lines, and `canon markdown audit` reports the log there. Write the marker on the line after the title, so the log stays one file and a planner reads it in finding order.

- Keep the marker a whole line outside any fence, since the audit skips a fenced line and a marker sharing its line with other text matches nothing
- Give it a reason after the colon, since a marker naming none exempts nothing
- Never split the log to meet the ceiling, since a finding's number is its place in one sequence

### Setup rows

The setup table is written once, before the first finding, and every row stays even when its value is empty.

- `Commit`, `Copy`, and `Launch` come from making the copy, per `isolate.md`, or read as `live.md` sets for a drive of the live app
- `Address` is the `url` that `canon pr local --root <worktree> --json` confirmed in Step 1
- `Board` is the `url` the board's serve record returned and the drive's board project, written when the first finding is drawn, and stays empty when the drive draws no board
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

- Put the options screenshot at `evidence/<surface>/<nn>-options.png`, showing the section as shipped beside every option, with each continuation page's own `<nn>-options-<k>.png` beside it
- Copy the mock source into `evidence/mocks/<surface>/`, where `<surface>` names the screen or panel drawn on
- Write `Drawn` above the decision, citing paths under `evidence/` the way `Evidence` does, or `skipped, <reason>` when the change has nothing visible
- A bare `skipped` with no reason counts as undrawn, since the next reader cannot tell a choice from an omission
- A decision reading `see <nn>` was drawn under the finding it names and carries no `Drawn` of its own

A skip also fails when the intake item deciding the finding names a rendered-surface file in its `Fix:` or `Worth it:` line, since a person sees that change. Move a path that only explains the defect out of those two lines.

Leave a board page out of `Drawn`, since the check reads every code span there as an evidence path and fails a ref outside `evidence/`. The `Board` setup row already names the project.

### Passed goals

A goal tried and passed takes a heading too, so the next drive can tell a goal checked from one skipped. Its meta line reads `pass` · goal · persona, and it carries `Did` and `Evidence` alone. A Behavior row tried and passed takes the same heading, with `behavior` as its source.

### Passed scripts

A script run and passed takes a heading per persona, as a passed goal does. Its meta line reads `pass` · script · persona, its `Did` names the script path and each numbered step that passed, and it carries `Evidence`.

A step that fails ends the run of that script for that persona. It becomes a finding with source `script`, its `Did` naming the step number, and the steps after it go unrun.

### Operator images

Operator images count as evidence on arrival. One showing a finding takes that finding's number and is cited from its `Evidence` field. One no finding cites yet is a reference shot with a heading of its own.

```markdown
## ref-01. The operator's Figma typography panel

- **Evidence:** `evidence/refs/ref-01-figma-typography.png`
```

- `ref-<nn>` numbers reference shots apart from findings, so a later finding citing one keeps the path it already has
- Keep the pasted file's own extension when it is not a PNG

### A paste with no file

Confirm the pasted image's file exists on disk before writing any path to it. A paste can reach the session in chat alone, with no file behind it, and a path cited first points at nothing.

- Write no `Evidence` path and no `drive.json` entry for an image with no file
- Describe the image in the finding's `Saw` line, saying it arrived in chat alone
- Tell the operator in the same turn, so they can save it or paste it again
- Give a later paste of the same image the number it would have had

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
  "behaviors": [
    {
      "surface": "board",
      "behavior": "A frame resizes from its corner grips, 120px to 1600px",
      "status": "driven"
    }
  ],
  "target": null,
  "scripts": [
    {
      "script": "canon/drive/basics.md",
      "persona": "a designer laying out a board",
      "status": "driven"
    }
  ],
  "evidence": ["evidence/board/01-board.png"],
  "worktree": "/tmp/tmp.Xy12/app"
}
```

- `goals` holds one entry per `## Goals` bullet, with the bullet's text. A bold label and a trailing period may stay or go, since the check strips both.
- `status` is `driven` or `not-driven`, and a `not-driven` entry carries the `reason` the goal could not be reached
- `evidence` lists every frame a finding cites and every image the operator pasted, reference shots included, each a path under `evidence/` relative to the intake folder
- `worktree` is the throwaway worktree's path, which the check fails on while it still exists. A drive of the live app writes `"worktree": null`, and the check refuses an empty string.

### Behaviors

The design record's `## Behavior` table lists the interactions a design session settled, one row per surface and interaction. The drive tries each row once, on the persona who meets that surface.

- `behaviors` holds one entry per row, with `surface` copied from the Surface cell, code span dropped, and `behavior` from the Behavior cell
- An entry takes the `status` and `reason` a goal entry takes, so a row the build cannot reach is `not-driven` with the reason
- The list is empty or absent when the project has no `canon/DESIGN.md` or the record has no `## Behavior` section
- A record carrying no list while rows exist reads every row as unmapped, rather than being refused

### Target and scripts

Two fields tie the record to the config, so the check reads the scripts the drive was meant to run.

- `target` names the config target the drive ran, or `null` for the flat default, and the check reads that target's scripts and personas
- `scripts` holds one entry per configured script and persona, with the path and the persona copied from the config verbatim, since the check matches both exactly
- A script entry takes the `status` and `reason` a goal entry takes, and the list is empty or absent when the config names no scripts

### What the check fails

A failed check names each finding by list, and an empty list is a clean axis.

| List              | Fails on                                                             |
| ----------------- | -------------------------------------------------------------------- |
| `unmapped`        | a goal with no entry                                                 |
| `unreasoned`      | a `not-driven` goal with no reason                                   |
| `unknown`         | an entry naming no goal the requirements hold                        |
| `unscripted`      | a configured script a persona did not run, or skipped with no reason |
| `changed`         | a main checkout path that moved since the baseline                   |
| `strayEvidence`   | an evidence path outside `evidence/`                                 |
| `missingEvidence` | an evidence path holding no file                                     |
| `undrawn`         | a logged decision with no drawn outcome or reason                    |
| `worktreeLeft`    | the `worktree` path still on disk                                    |
| `behavior`        | a Behavior row unmapped, unreasoned, or unknown, named by its prefix |
