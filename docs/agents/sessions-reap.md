---
title: Sessions reap
description: Stopping the background sessions a task recorded once its work ends, the finished sweep, the skips that protect live work, and the outcomes each row reads
kind: reference
---

# Sessions reap

`canon sessions reap` stops the background sessions that did a task's work, so the agent view shows live work rather than hundreds of finished runs. It stops by default, which keeps each conversation for `claude attach`, and removes only under `--remove`.

```bash
canon sessions reap v196.1-launch-report --json
canon sessions reap --finished --dry-run --json
canon sessions reap --finished --remove --write --json
```

Run `canon sessions reap --help` for every flag. The verb takes one of two forms, and each matches the roster by full sessionId, never by a name or a prefix.

| Form     | Reaches                                                                                    | Runs                                     |
| -------- | ------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Task     | The sessions one task's `Sessions:` line records, live or archived                         | After a merge or a planner's landed plan |
| Finished | Background sessions here on settled tasks alone, or on none and idle past `--idle-minutes` | Under `--write`, or `--dry-run` first    |

The finished form reaches sessions nobody named, which is why it refuses without `--write`. Its idle threshold is 60 minutes unless `--idle-minutes` says otherwise.

## Output

Each row in `sessions` carries `sessionId`, `name`, `outcome`, `reason`, and `detail`.

- `stopped` or `removed`: the client ran and the roster dropped the session
- `would-stop` or `would-remove`: a dry run, so nothing ran
- `skipped`: left alone, with a reason
- `gone`: recorded on the task and no longer on the roster, which is not an error
- `failed`: still on the roster after the client ran, with its output in `detail`

The reap judges each session by reading the roster again after `claude stop` or `claude rm`, never by the client's exit, since the client's own report is unreliable. A `failed` row exits 1.

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

A recorded session reading `shell` holds a background command, such as a preview server or a review wait, and the stop ends it. A session no task records reads `busy` on `shell`, since its status is all the reap knows about it.

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
