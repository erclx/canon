---
title: Sessions reap
description: Stopping the background sessions a task recorded once its work ends, the finished sweep, the skips that protect live work, and the outcomes each row reads
kind: reference
---

# Sessions reap

`canon sessions reap` stops the background sessions that did a task's work, so the agent view shows live work rather than hundreds of finished runs. It stops by default, which keeps each conversation for `claude attach`, and removes only under `--remove`.

```bash
canon sessions reap parser-rewrite --json
canon sessions reap --finished --dry-run --json
canon sessions reap --finished --remove --write --json
```

Run `canon sessions reap --help` for every flag. The verb takes one of two forms, and each matches the roster by full sessionId, never by a name or a prefix.

| Form     | Reaches                                                                                    | Runs                                     |
| -------- | ------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Task     | The sessions one task's `Sessions:` line records, live or archived                         | After a merge or a planner's landed plan |
| Finished | Background sessions here on settled tasks alone, or on none and idle past `--idle-minutes` | Under `--write`, or `--dry-run` first    |

The finished form reaches sessions nobody named, which is why it refuses without `--write`. Its idle threshold is 60 minutes unless `--idle-minutes` says otherwise. On the task form the same flag sets how long a live task's session must hold a background shell before it reads as finished, 65 minutes by default.

## Output

Each row in `sessions` carries `sessionId`, `name`, `outcome`, `reason`, and `detail`. A row the reap acted on also carries `clientId`.

- `stopped` or `removed`: the client ran and the roster dropped the session
- `would-stop` or `would-remove`: a dry run, so nothing ran
- `skipped`: left alone, with a reason
- `gone`: recorded on the task and no longer on the roster, which is not an error
- `failed`: still on the roster after the client ran, with its output in `detail`, or not listed by the client at all, so nothing ran

The reap judges each session by reading the roster again after `claude stop` or `claude rm`, never by the client's exit, since the client's own report is unreliable. A `failed` row exits 1.

The client's `stop` and `rm` take the short `id` that `claude agents --json` lists beside each `sessionId`, and refuse the full one. The reap reads that listing at reap time, before the dry-run branch, and `clientId` names the id it passed or would pass. It reads `null` where the client listed no such session, and the reap never guesses one.

**Listeners**

Every reap ends the listeners inside each reaped session's linked worktree under `.claude/worktrees/`, so a preview server the worker left behind gives up its port. The worktree and its branch stay in place.

- A stop ends them once the roster drops the session, so a `failed` row keeps the server its live session owns
- `--remove` ends them ahead of the client's removal, the order `canon worktrees reclaim` keeps
- A dry run lists what would end and sends no signal
- The main checkout, a sibling worktree, and a worktree another session on the roster still holds are never signaled

The record's top-level `listeners` reads `{ kind: 'read', stopped: [{ path, pids, ports }] }` for what ended. It reads `{ kind: 'unread' }` on a machine with neither `/proc` nor `lsof`, which says nothing about what still listens. It is `null` where no target had a worktree to end.

**Skips**

Every form leaves the sessions below alone, and the row's `reason` says which skip held.

| Reason        | Session                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------- |
| `caller`      | The one running the command                                                               |
| `kept`        | Named by `--keep`, such as a planner held for reuse, which nothing on disk marks          |
| `interactive` | Not a background session, so a person is in it                                            |
| `controller`  | An orchestrator, the controller of its wave                                               |
| `talk`        | Its name carries `-talk`, so it waits on the operator                                     |
| `busy`        | A turn still running, its status in `detail`                                              |
| `usage-limit` | Stopped at a usage limit, which the operator resumes                                      |
| `open-task`   | A live task other than the one named also records it, that task in `detail`               |
| `recent`      | Finished form only: no task records it and its dwell is under the threshold or unmeasured |

A session reading `shell` holds a background command, such as a preview server or a review wait. It counts as finished when every task recording it is archived or declined, and the stop ends the command. Otherwise it reads `busy`, since the command is usually a check the session still waits on, until one of the stops below applies.

**Stops past a status**

The task form stops three more sessions a status alone would have blocked, and the row's `reason` names why. A landed reviewer reading `idle` or `waiting` stops on its status and carries no reason.

| Reason        | Session                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `merged`      | Any status, once a pull request the task records is on the trunk this clone holds                     |
| `planned`     | A `planner-` session holding no branch and reading `shell`, on a task whose `Plan:` line links a plan |
| `shell-dwell` | Any other session reading `shell` on the live task named, its dwell past `--idle-minutes`             |

A `busy` session never reads `shell-dwell`, nor does one with no measured dwell. The dwell restarts on every status change, so a session that ran a turn since is safe while the machine stays awake.

- Time the machine spent asleep counts toward the dwell, so a check minutes old at suspend can read `shell-dwell` on wake. Pass `--idle-minutes 0` on a reap run after a wake.
- The 65-minute default outlasts a CI watch, which stops itself at 60 minutes. A longer command ends with the stop, so raise `--idle-minutes` or pass `--keep` while one is expected.
- `--idle-minutes 0` turns the reading off on the task form, so every held shell on a live task reads `busy`
- The finished form never reads `shell-dwell`, so its 60 minutes time an idle session alone

The caller, kept, controller, and talk skips still run first. A clone behind the remote reads a merged pull request as not landed, so the reap keeps skipping it.

## Refusals

Branch on `reason` in the record, not the exit code.

| Reason          | Meaning                                                              |
| --------------- | -------------------------------------------------------------------- |
| `no-registry`   | No session registry exists, so nothing was read                      |
| `no-task`       | No task with that stem on the board, in the archive, or declined     |
| `no-repository` | The finished form found no repository at the working directory       |
| `needs-write`   | The finished form ran without `--write` or `--dry-run`               |
| `bad-input`     | Neither a task nor `--finished`, both, or an unreadable idle minutes |

## See also

- `canon sessions list --help`: the roster the reap reads
- `canon tasks session --help`: how a session lands on a task's `Sessions:` line
- `canon worktrees reclaim`: run after a remove, since `claude rm` reports a worktree removal unreliably
