---
title: Drive record
description: The drive log line, the severity scale, the finding sources, and the drive.json shape that canon intake drive-check reads
---

# Drive record

Read before the first finding of `app-drive`. A drive leaves two records in its intake folder, being a log a person reads and `drive.json`, which the check reads.

## The drive log

Write the log to `evidence/drive-log.md` inside the intake folder, one line per finding, appended as the finding happens.

```plaintext
- <nn>. [<severity>] [<source>] <persona>: did <action>, saw <result>. Evidence: evidence/<nn>-<name>.png
```

- `<nn>` numbers findings in the order they were found, and the frame carries the same number
- `<source>` is `goal`, `last-drive`, or `operator`. A finding naming none sorts as taste.
- `<result>` carries the number read off the page or the app when the claim has one, such as `scrollWidth 436 against clientWidth 320`
- A goal tried and passed takes a line too, as `[pass] [goal]`, so the next drive can tell a goal checked from one skipped

### Operator images

Operator images count as evidence on arrival. One showing a finding takes that finding's number and is cited from that finding's line, while one no finding cites yet is a reference shot with a log line of its own.

```plaintext
- ref-<nn>. [operator] <what the image shows>. Evidence: evidence/ref-<nn>-<name>.png
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
