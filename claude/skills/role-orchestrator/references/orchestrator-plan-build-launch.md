---
title: Orchestrator plan-and-build launch
description: The launch that hands a row to one session that writes its plan and then builds it through auto-ship --plan-first, the 5-file bound and weight stop with the --any-size override, the --stop-after-plan argument, the waiting message the session sends on an open call, and which dispatch checks bind when no plan exists at launch
---

# Dispatch to plan and build a row

A row that reads small goes to one session that plans and builds it, rather than a planner and then a cold worker re-reading the same files. `auto-ship --plan-first` writes and links the plan before its first edit, and review stays a separate session.

```bash
claude --bg --model <model> --effort <effort> --disallowedTools AskUserQuestion -n "worker-<project>-<slug>" "/canon:auto-ship --plan-first <task>
Your controller is the session whose sessionId is <dispatcher-id>. Resolve its current name from that id through canon sessions list --json, which carries sessionId per row, at the moment you send, and never resolve an addressee by name prefix. Message it when the plan lands, carrying its path, and when the pull request opens, carrying the number, the branch, the head sha, the CI state, and every point you departed from the plan on, and message it again if you stop on a question."
```

`<task>` and `<slug>` resolve off the row the way the planning shape in `orchestrator-launch.md` resolves them, and the rest as its build shape does. Record the worker on its task as the build shape does.

## The arguments after the task

Each argument goes after `<task>`, and the session reads them in the order below.

- `--stop-after-plan` ends the run once the plan is announced, for an operator who reads the plan before a build
- `--any-size` builds the plan whatever its file count and weight, only when the operator and this session chose to build a larger row this way

## Reading a row as small

Judge the row from its task file, since no plan exists yet. A fix naming up to 5 files, with no finding of an open cause, reads small. The session's own test on the plan it writes is the check.

- It builds a plan touching 5 files or fewer whose weight is not heavy, and stops linked and unbuilt on either reading past that
- A question carrying a suggestion holds nothing, since a blank answer accepts it, and the plan announcement names each one the session executes

## Which checks bind here

None of the three checks in `orchestrator-dispatch.md` can run at launch, since each reads a plan.

- The plan-answer gate runs in the session on the plan it wrote
- The branch check runs in the session on the same plan, which stops on a claim or an unverified reading
- The conflict check runs on the announced plan, since its file list is the first this session can compare. Message the session to stop on a hold. It reads its messages before the worktree entry.
- Promote the row with `canon tasks promote` when the plan announcement arrives, not at launch, since the session's link moves it to `## Up next` first

### An open call

A question marked as needing the operator's call holds the session on `canon tasks launchable <task> --wait`, bounded at the verb's default of 1800 seconds. The session messages this controller with the open slot before the wait starts.

- Put the question to the operator and have the answer written in the plan's slot, which ends the wait on `launchable`
- A wait reading `timeout` stops the session with the plan linked, so relaunch onto the same task once the slot is answered
