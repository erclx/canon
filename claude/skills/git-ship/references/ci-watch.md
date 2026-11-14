---
title: CI watch fallback and refusals
description: What the git-ship CI watch does when the installed CLI predates the checks verb, when a read is refused, and when the watch reaches its own limit
---

# CI watch fallback and refusals

Applies to step 9 of `git-ship` once the watch wakes on anything but a `state` of `passing` or `failing` or a `conflicted: true` record, to a `failing` record whose failed runs were all cancelled, and to a target whose CLI carries no `canon pr checks`.

## The fallback watch

When `canon pr checks <number> --json` returns no record at all, the target's CLI predates the verb. The polling loop would never exit on such a target, since an empty read never satisfies its test. Start this loop instead, with `run_in_background` and the same 65-minute timeout:

```bash
SECONDS=0; until gh pr checks <number> >/dev/null 2>&1; [ $? -ne 8 ]; do if [ "$SECONDS" -ge 3600 ]; then echo "CI watch limit reached after 60 minutes"; break; fi; sleep 30; done; gh pr checks <number>
```

It polls while `gh pr checks` exits 8, which gh documents as checks pending, and ends on any other exit or at the 60-minute limit. `gh pr checks --watch` never ends on its own either, so the fallback carries the main loop's limit for the reason the body's `### Why the loop carries its own limit` states.

The fallback prints a check table rather than a record, and has no `conflicted` field to separate a conflict from lag. The first matching row routes.

| Output                                | Route                                                    |
| ------------------------------------- | -------------------------------------------------------- |
| At least one check, every one passing | Continue to After completion                             |
| Any failing check                     | Stop the sequence, naming it with its URL                |
| The limit line, or a backstop kill    | Stop on the unsettled read below, reporting CI unsettled |
| Empty or errored                      | Stop the sequence and report the message                 |

Empty output stops rather than waits, since `no checks reported on the '<branch>' branch` is what a conflicted branch prints.

## Refused and unsettled reads

None of these is a pass, and none emits `✅ Shipped`. A `reason` and no `state` means the read was refused, and the watch sorts refusals into two kinds.

| Kind      | Reasons                                                      | What the watch did                                               |
| --------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| Permanent | `no-remote-branch`, `ambiguous-pull`, `no-branch`            | Exited on the first one, since no amount of waiting changes them |
| Transient | Every other reason, such as `gh-failed` or `runs-unreadable` | Kept polling, since the next read can clear                      |

The set lives in the watch command rather than in the verb, so a refusal `canon pr checks` adds later defaults to transient and waits, which is the safe side.

- A permanent refusal ends the sequence. Stop and report that `reason`, such as `no-remote-branch` for a branch deleted on the remote.
- A transient refusal in the final record with no limit line came from the read after the loop, which never exits on one. Read `canon pr checks <number> --json` once more and route on that.
- A second refusal on that read stops the sequence with its `reason`

### The unsettled read

A watch that printed `CI watch limit reached after 60 minutes` ran to its own limit with no terminal state. Stop and report CI unsettled after 60 minutes, naming the final record's `state` or `reason`, or the pending checks a fallback table lists, since a `pending` record or a transient refusal that never cleared both end here.

- A `pending` record is never a pass and never enters the cancelled-run rerun below
- A watch the tool's backstop killed prints no final record, which reads as CI unsettled the same way

Do not auto-fix any of these. A stop report is one of the two exceptions to the no-text-between-steps rule.

## A failing record with only cancelled runs

A run cancelled by a runner or a superseded workflow reads as `failing`, and a reviewer reads it as a real failure. This section decides whether a `failing` wake reruns or stops, and the rerun is the one exception to the no-auto-fix rule.

List the failed check runs on the record's `tip`, keeping the newest run per check name as `canon pr checks` does, and print each run id when every one of them was cancelled. The read goes through REST, since `gh pr checks` runs on GraphQL and a cloud session's proxy refuses it:

```bash
gh api "repos/{owner}/{repo}/commits/<tip>/check-runs?per_page=100" --jq '[.check_runs | group_by(.name)[] | max_by(.id) | select(.conclusion | IN("failure", "timed_out", "cancelled", "action_required", "startup_failure"))] | if length > 0 and all(.conclusion == "cancelled") then [.[].details_url | capture("/runs/(?<id>[0-9]+)").id] | unique | .[] else empty end'
```

- A non-zero exit means the read was refused, so stop and report the refusal rather than reading it as a real failure
- An empty print on a zero exit means at least one check really failed, so stop and report it with its URL
- Otherwise run `gh run rerun <id> --failed` once per printed id, then start the watch again from `### Watching CI`
- Rerun once per ship. A second `failing` wake on the same cancelled runs stops and reports them as cancelled, naming each URL.
