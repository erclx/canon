---
title: Plan-first launch
description: How auto-ship Step 0 writes and links a small row's plan in the session that then builds it, the Small test stop and its --any-size override, the branch claim and plan-answer read it runs in place of the dispatcher's, and the plan announcement it owes the controller
---

# Write the plan first

Step 0 of `auto-ship`. The session reads this file when the launch carries `--plan-first <task>`, after `canon:role-worker` and before the worktree entry.

## The steps

The plan lands as a validated, linked file before any edit to a tracked file, so scope is never written after the build. No plan exists when the dispatcher runs its checks, so steps 3 and 4 run them here instead.

1. Read the task. When it already carries a `Plan:` line, write nothing and continue with that plan, so a re-dispatch resumes.
2. Otherwise invoke `canon:plan-feature <task>` and ask it for a file. It validates the plan and links it, which moves the row to `## Up next`.
3. Apply the Small test of `plan-feature` Step 4 to the written file. Under `--any-size`, run `canon tasks plan-answers <plan> --json` in its place.
4. Run `canon tasks plan-branch <plan> --json`, then `canon sessions list --branch <branch> --json`, and read `claimed` against the stops below.
5. Send the controller the plan path per `canon:role-worker` and continue without waiting, since that message is its cue to promote the row.

## The stops

Each stop leaves the plan linked and nothing built, so a relaunch onto the same task resumes at step 1. Send the line to the controller as a block before the turn ends.

| Reading                                                     | Stop line                                                                                       |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| The Small test fails, with no `--any-size`                  | `❌ <plan> fails the Small test (<criterion>). Relaunch with --any-size to build it.`           |
| `launchable` reads anything but true, under `--any-size`    | `❌ <plan> is not launchable (<reason>). Settle it and relaunch.`                               |
| `claimed: true`                                             | `❌ <branch> is held by <holder>. Relaunch once it clears.`                                     |
| `claimed: false` unverified, a refusal, or no `claimed` key | `❌ The claim on <branch> could not be read (<missing reading>). Relaunch once it reads clean.` |

An unverified `claimed: false` is one carrying `sessionsReadable` or `refsReadable` false, the reading `${CLAUDE_SKILL_DIR}/../role-orchestrator/references/orchestrator-dispatch.md` treats as unverified too.

## What else holds

Four rules hold on every plan-first run.

- The launch is the go-ahead `plan-feature` waits for before implementation, so its stop after the plan ends that skill and not this chain
- Step 5 stands in for the `Next:` message `plan-feature` would send, so send one, not both
- Under `--any-size`, a question needing the operator's call still stops the run, as `canon:role-worker` states
- Name the worktree from the plan these steps wrote or found, and pass that path to Step 1 as the caller-supplied plan
