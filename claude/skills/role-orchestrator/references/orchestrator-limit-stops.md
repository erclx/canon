---
title: Orchestrator limit stops runbook
description: Finding the sessions a usage limit stopped through the roster, and resuming each from its own record with one fixed message
---

A usage limit stops every session on the account at once, and each one then reads `idle`, `shell`, or `waiting` as though it had finished. Run this pass on the operator's ask, or on this session's own first turn after a limit stop, once the limit has lifted.

## Finding the rows

Read the roster and keep what this session can reach.

```bash
canon sessions list --stopped --json
```

- Keep this repository's rows and report the rest to the operator, since `session-relay` refuses a send across repositories
- Report `stopsUnread` when it is above zero, since those rows may be stopped and nothing will message them
- Find each row's task with `grep -l <sessionId> .canon/tasks/*.md` at the main worktree root, since `canon tasks session` writes the id there
- Report a refusal of the flag as an older CLI behind the plugin, never as an empty list

### What the watch cannot tell you

`orchestrator-watch.md` reads a worker gone idle as finished, so a limit-stopped worker reports that way there. Its `WORKER-STOPPED` line means a long `waiting` row and says nothing about a limit, so read the `stopped` field in full on every row this pass decides.

## Sending

Each row takes the same message with its own record filled in.

```plaintext
The usage limit lifted. Re-read <record> and continue. Re-run any command whose result you never read.
```

The last sentence covers a session stopped between starting a command and reading what came back, such as a reviewer stopped mid-lift.

Fill `<record>` by the row's role, read off its name.

| Row      | `<record>`                                   |
| -------- | -------------------------------------------- |
| Worker   | The plan its task links                      |
| Reviewer | `.canon/review/branch-<slug>.md`             |
| Planner  | Its task                                     |
| No task  | Its branch, and list the row to the operator |

Send each row the message through `canon:session-relay`, then run the roster read again. A resumed row reads `busy` mid-turn and comes back null, so a second pass cannot message it twice.

Stop sending when a row still reads stopped with a new reset, since the limit has not lifted. Report that reset to the operator and hold the rest of the wave.
