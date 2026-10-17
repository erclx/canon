---
title: CI watch fallback and refusals
description: What the git-ship CI watch does when the installed CLI predates the checks verb, when a read is refused, and when the watch times out
---

# CI watch fallback and refusals

Applies to step 9 of `git-ship` once the watch wakes on anything but a `state` of `passing` or `failing` or a `conflicted: true` record, and to a target whose CLI carries no `canon pr checks`.

## The fallback watch

When `canon pr checks <number> --json` returns no record at all, the target's CLI predates the verb, and the watch command is `gh pr checks <number> --watch`. The polling loop would never exit on such a target, since an empty read never satisfies its test.

The fallback prints a check table rather than a record, and has no `conflicted` field to separate a conflict from lag.

| Output                                | Route                                     |
| ------------------------------------- | ----------------------------------------- |
| At least one check, every one passing | Continue to After completion              |
| Any failing check                     | Stop the sequence, naming it with its URL |
| Empty or errored                      | Stop the sequence and report the message  |

Empty output stops rather than waits, since `no checks reported on the '<branch>' branch` is what a conflicted branch prints.

## Refused and unsettled reads

Neither of these is a pass, and neither emits `✅ Shipped`.

- A `reason` and no `state` means the read was refused, such as `no-remote-branch` for a branch deleted on the remote. Stop and report that `reason`.
- A watch that hit its timeout and printed no final record is CI unsettled after 60 minutes, so report it that way

Do not auto-fix any of these. A stop report is one of the two exceptions to the no-text-between-steps rule.
