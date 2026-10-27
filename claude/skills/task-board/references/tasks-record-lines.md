---
title: Task record lines reference
description: The lines a verb writes on a task below its origin lines, being the Pull request line that lets a merge close its task, the Pending branch marker that holds that merge back, and the Sessions line naming who worked it
---

# Task record lines reference

Applies to the lines a task carries under its origin lines that no session writes by hand. Each one has a `canon tasks` verb as its writer, and this file fixes what each line means and who calls that verb.

This is an attribute standard. It governs lines inside a task file rather than a file of its own, so it carries no template.

## Scope

Governs the `Pull request:`, `Pending branch:`, and `Sessions:` lines.

Does not govern:

- The task file's layout, filename, format, origin lines, and archiving: `tasks.md`
- The `Declined:` line: `tasks-decline.md`

## The `Pull request:` line

`Pull request:` lists every pull request that shipped part of the task as bare numbers, oldest first and comma-separated, as in `Pull request: #NNN, #NNN`. It is not an origin, so a task without one is well-formed, and `git-pr` appends to it when a pull request opens.

The line lets a merge close its own task. `canon tasks archive --pull-request <n>` finds the task by any listed number and archives it only on the last.

- One pull request, one task. Two tasks naming the same number refuse to archive rather than both moving.
- `Pending branch: <branch>` holds that merge back while a branch that ticked an outcome waits on its own number
- `canon tasks outcome` writes that line, skipping it when the branch's pull request is already listed, and `canon tasks pull-request` clears it

## The `Sessions:` line

`Sessions:` names each session that built or reviewed the task, by roster name and full sessionId, as in `Sessions: <name> (<sessionId>), <name> (<sessionId>)`. A retro or a regression hunt reaches each transcript through `canon sessions export <sessionId>`, which takes the full id alone. It is not an origin either.

- `canon tasks session <sessionId> <task>` writes it, or `--plan <slug>` in place of the stem, so it is never hand-edited
- The verb reads the name off the live roster. A session that already exited takes `--name`, and so does a cloud session's `session_` id, since the roster never lists one.
- The id is the key. A repeat call for a listed id keeps the name first recorded, so two callers recording one worker write it once.
- The dispatcher records each worker and reviewer it launches, and `git-pr` records the session opening the pull request, which covers a hand launch

The line sits below the origin, `Pull request:`, and `Pending branch:` lines. `canon tasks validate` reports a line that does not parse as name and id pairs as `sessions-misshapen`.
