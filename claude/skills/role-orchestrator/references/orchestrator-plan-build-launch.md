---
title: Orchestrator plan-and-build launch
description: The launch that hands a small row to one session that writes its plan and then builds it through auto-ship --plan-first, how a row reads small before a plan exists, the --any-size override, and which dispatch checks bind when no plan exists at launch
---

# Dispatch to plan and build a small row

A row that reads small goes to one session that plans and builds it, rather than a planner and then a cold worker re-reading the same files. `auto-ship --plan-first` writes and links the plan before its first edit, and review stays a separate session.

```bash
claude --bg --model <model> --effort <effort> -n "worker-<project>-<slug>" "/canon:auto-ship --plan-first <task>
Your controller is the session whose sessionId is <dispatcher-id>. Resolve its current name from that id through canon sessions list --json, which carries sessionId per row, at the moment you send, and never resolve an addressee by name prefix. Message it when the plan lands, carrying its path, and when the pull request opens, carrying the number, the branch, the head sha, the CI state, and every point you departed from the plan on, and message it again if you stop on a question."
```

`<task>` and `<slug>` resolve off the row the way the planning shape in `orchestrator-launch.md` resolves them, and the rest as its build shape does. Add `--any-size` after `<task>` only when the operator and this session chose to build a larger row this way. Record the worker on its task as the build shape does.

## Reading a row as small

Judge the row from its task file, since no plan exists yet. A fix naming one or two files, with no finding of an open cause, reads small. The session's own Small test on the plan it writes is the check, and a plan failing it stops linked and unbuilt.

## Which checks bind here

None of the three checks in `orchestrator-dispatch.md` can run at launch, since each reads a plan.

- The plan-answer gate runs in the session under `--any-size`, and a plan passing the Small test carries no question for it to hold
- The branch check runs in the session on the plan it wrote, which stops on a claim or an unverified reading
- The conflict check runs on the announced plan, since its file list is the first this session can compare. Message the session to stop on a hold.
- Promote the row with `canon tasks promote` when the plan announcement arrives, not at launch, since the session's link moves it to `## Up next` first
