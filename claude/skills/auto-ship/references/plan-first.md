---
title: Plan-first launch
description: How auto-ship Step 0 writes and links a row's plan in the session that then builds it, the file bound and weight stop with their --any-size override, the --stop-after-plan argument, the bounded wait on a question needing the operator's call, the branch claim it runs in place of the dispatcher's, and the plan announcement it owes the controller
---

# Write the plan first

Step 0 of `auto-ship`. The session reads this file when the launch carries `--plan-first <task>`, after `canon:role-worker` and before the worktree entry.

## The steps

The plan lands as a validated, linked file before any edit to a tracked file, so scope is never written after the build. No plan exists when the dispatcher runs its checks, so steps 3 to 6 run them here instead.

1. Read the task. When it already carries a `Plan:` line, write nothing and continue with that plan, so a re-dispatch resumes.
2. Otherwise invoke `canon:plan-feature <task>` and ask it for a file. It validates the plan and links it, which moves the row to `## Up next`.
3. Decide whether this session builds the plan, reading the tests under `## Whether this session builds` in their order.
4. Run `canon tasks plan-branch <plan> --json`, then `canon sessions list --branch <branch> --json`, and read `claimed` against the stops below.
5. Send the controller the plan path per `canon:role-worker`, naming the step 3 reading, each suggested question this run executes, and any it waits on.
   - The reading is `builds`, or the stop it took, so the controller promotes only on `builds` and runs its conflict check either way
6. Run `canon tasks plan-answers <plan> --json`. On `launchable`, continue. On an open question, wait on it as `## The wait` states.

Before the worktree entry, act on any controller message that arrived since step 5. A stop on a hold ends the run with the plan linked and nothing built.

## Whether this session builds

Three tests decide it, read in this order, and the first that answers ends the reading.

1. `--stop-after-plan` stops after step 5 on any plan, for an operator who reads the plan before a build.
2. `--any-size` builds the plan whatever its file count and weight.
3. Otherwise the session builds a plan touching 5 files or fewer whose `**Weight:**` field is not `heavy`, and stops on either reading past it.

Count the backticked-path bullets under `## Files to touch`, counting a rename once, since that is the list every plan parser reads. Heavy stops at any count, since it marks an unknown cause, a safety risk, or a contract with unnamed consumers, which a file count does not see.

A question carrying a suggestion is no stop. A blank answer accepts the suggestion under the plan contract, so the session builds it and names it in the step 5 message.

## The wait

A question marked as needing the operator's call waits on a slot only the operator fills. The halt `canon:role-worker` states takes a bounded wait here, since a relaunch would only re-read the same open slot.

- Run `canon tasks launchable <task> --wait --json` in the background and act on its wake, since the verb's default of 1800 seconds outlasts a foreground shell call
- Branch on the record's `reason` rather than on the exit, which a shell function wrapping `canon` can flatten to zero
- On `launchable`, read the operator's answer from the plan and continue to the worktree entry
- On `timeout` or a refusal, stop on its line below

## The stops

Each stop leaves the plan linked and nothing built. A size stop continues in the same session on `/canon:auto-ship <plan>`, and any other stop resumes at step 1 on a relaunch onto the same task. Send the line to the controller as a block before the turn ends.

| Reading                                                     | Stop line                                                                                                        |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `--stop-after-plan`                                         | `⏸️ <plan> is written and linked. The launch asked to stop after the plan.`                                      |
| More than 5 files, with no `--any-size`                     | `❌ <plan> touches <n> files, past the 5 built here. To build it in this session, send /canon:auto-ship <plan>.` |
| Graded heavy, with no `--any-size`                          | `❌ <plan> is graded heavy. To build it in this session, send /canon:auto-ship <plan>.`                          |
| `claimed: true`                                             | `❌ <branch> is held by <holder>. Relaunch once it clears.`                                                      |
| `claimed: false` unverified, a refusal, or no `claimed` key | `❌ The claim on <branch> could not be read (<missing reading>). Relaunch once it reads clean.`                  |
| The wait reads `timeout`                                    | `❌ <plan> still waits on <open slots> after <seconds>s. Answer it and relaunch.`                                |
| `plan-answers` or the wait refuses                          | `❌ <plan> is not launchable (<reason>). Settle it and relaunch.`                                                |

An unverified `claimed: false` is one carrying `sessionsReadable` or `refsReadable` false, the reading `${CLAUDE_SKILL_DIR}/../role-orchestrator/references/orchestrator-dispatch.md` treats as unverified too.

## What else holds

Three rules hold on every plan-first run.

- The launch is the go-ahead `plan-feature` waits for before implementation, so its stop after the plan ends that skill and not this chain
- Step 5 stands in for the `Next:` message `plan-feature` would send, so send one, not both
- Name the worktree from the plan these steps wrote or found, and pass that path to Step 1 as the caller-supplied plan
