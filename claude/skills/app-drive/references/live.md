---
title: Driving the live app
description: The alternative to isolate.md for a drive with no copy, covering when the operator's word allows it, the write scope, the setup rows, the record, the server, and the close
---

# Driving the live app

Read on reaching Step 1 of `app-drive` when the operator asks to drive the app they already run, and again at the close. It replaces `isolate.md` for that drive alone, so nothing here makes a copy.

## When it is allowed

- Drive the live app only when the operator names it in their own words, such as "drive what I have running". Never infer it from a busy port or a slow build.
- Refuse a goal that deletes, overwrites, or resets data the operator did not name, and drive it in a copy per `isolate.md` instead
- Ask again when the operator's word covered one target and the drive reaches another

## Write scope

The drive writes into the running app only through a page, document, or project made for the drive, named after the drive's slug. The operator's own content is read and never edited.

- Ask before the scratch project lands at a tracked path in the checkout, since `drive-check` reports it under `changed` and nothing in the folder can fix that
- Leave the checkout's files alone in every other way. The write scope in `SKILL.md` still holds for the intake and scratch folders.

## Setup rows

Fill the drive log's setup table in the shape `drive-record.md` sets, with three rows read differently.

| Row       | Value                                                                |
| --------- | -------------------------------------------------------------------- |
| `Copy`    | `none, live app on the operator's word`                              |
| `Launch`  | the command that actually started the server, as the operator ran it |
| `Address` | the `url` from `canon pr local --root <checkout> --json`             |

`<checkout>` is the folder the running server serves from. A server whose process runs outside it is not the app the operator named, so ask rather than drive an address the verb did not report.

## Baseline

Record the baseline with `canon intake drive-check <slug> --baseline --json` before the first step, as Step 1 states. The check reads `git status`, which skips ignored paths, so a rebuild of an ignored build folder shows nothing under `changed`.

## The record

Write `"worktree": null` in `drive.json`. The check reads `null` as a drive with no copy, and refuses an empty string, so never write `""` or leave a path that names the checkout.

## The server

- Stop or restart a server only on a port `canon pr local --root <checkout> --json` reported, never on a port picked by number
- Restart it only on the operator's word, since they may be working in it
- Follow the joint-drive rules under `### Driving the page` in `SKILL.md` for every click, since the operator shares the page

## Close

Close only on the operator's word, as `SKILL.md` states.

1. Remove no worktree, since none was made.
2. Leave the server up or stop it as the operator says.
3. Keep the scratch project the drive wrote into, as the board project is kept, and name it to the operator.
4. Run `canon intake drive-check <slug> --json`, and report each path under `changed` without reverting it.
