---
title: Plan-first launch
description: How auto-ship Step 0 writes and links a small row's plan in the session that then builds it, the Small test stop and its --any-size override, the branch claim it runs in place of the dispatcher's, and the plan announcement it owes the controller
---

# Write the plan first

Step 0 of `auto-ship`. The session reads this file when the launch carries `--plan-first <task>`, after `canon:role-worker` and before the worktree entry.

## The steps

The plan lands as a validated, linked file before any edit to a tracked file, so scope is never written after the build. No plan exists when the dispatcher runs its checks, so step 4 runs the branch claim here instead.

1. Read the task. When it already carries a `Plan:` line, write nothing and continue with that plan, so a re-dispatch resumes.
2. Otherwise invoke `canon:plan-feature <task>` and ask it for a file. It validates the plan and links it, which moves the row to `## Up next`.
3. Apply the Small test of `plan-feature` Step 4 to the written file. A plan failing it stops here, linked and unbuilt, unless the launch also carries `--any-size`.
4. Run `canon tasks plan-branch <plan> --json`, then `canon sessions list --branch <branch> --json`, and stop on `claimed: true`.
5. Send the controller the plan path per `canon:role-worker` and continue without waiting, since that message is its cue to promote the row.

## The size stop

The size stop reads `❌ <plan> fails the Small test (<criterion>). The plan is linked and nothing was built. Relaunch with --any-size to build it.` Send it to the controller as a block before the turn ends.

## What else holds

Three rules hold on every plan-first run.

- Step 5 stands in for the `Next:` message `plan-feature` would send, so send one, not both
- Under `--any-size`, a question needing the operator's call still stops the run, as `canon:role-worker` states
- Name the worktree from the plan these steps wrote or found, and pass that path to Step 1 as the caller-supplied plan
