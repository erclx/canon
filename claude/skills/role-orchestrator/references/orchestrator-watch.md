---
title: Orchestrator watch runbook
description: The long-running watch that reads pull requests and the session roster together, and the stall alarm it prints for a worker left waiting
---

Run the watch beside the poll when the dispatch fallback in `orchestrator-poll.md` is in force, or whenever a worker's exit has to be seen as well as its pull request. The poll classifies and routes, and this loop only reports.

## The watch beside it

`${CLAUDE_SKILL_DIR}/scripts/watch.ts` is a long-running loop rather than a scheduled prompt, started as `bun <path>` in the background. It writes nothing. Every sixty seconds it reads the open pull request list and the session roster together and prints one line per event.

- A new pull request
- A worker whose name, branch, or status changed
- A worker that dropped out of the roster

### What it buys over the poll

A worker that finishes goes idle and one that crashes disappears, so a trigger reading pull requests alone stays silent through the second. The roster read is the half `poll.ts` cannot make.

- It ran a full afternoon over four concurrent workers and caught every transition, while the three-minute poll it replaced reported no movement five times running
- It classifies and routes nothing, so the routing block in `orchestrator-poll.md` still decides whether a review follows and the two compose

### Who counts as a worker

Every session in the repository holding a branch other than the base one counts as a worker, whoever launched it, since matching the `orchestrator-` prefix would miss every hand-launched one.

A failed read of either source reports itself on a `watch:` line and leaves the baseline untouched, since reading an empty result as current state would report every worker gone on the pass after.

## The stall alarm

`watch.ts` prints `WORKER-STOPPED <name> <branch> <dwell>s` once a `waiting` row crosses `STALL_THRESHOLD_S`. It prints `WORKER-UNMEASURABLE <name> <branch>` for a row whose record carries neither timestamp the dwell falls back to.

- Both are prints, not alerts, so the operator learns of one only when a session already reading the output relays it
- The toolkit ships no notification verb, since a stall reaches the operator through a session tool rather than a command a shell loop can call

### Two levels of confidence

The two lines carry different confidence, and the push says so rather than treating them as one signal.

- `WORKER-STOPPED` fires only once the dwell has crossed the threshold, so it reports a wait already confirmed long
- `WORKER-UNMEASURABLE` has no dwell to threshold on, so it fires on the first pass meeting a stampless `waiting` row, whether it sat five seconds or fifty minutes

### Pushing the notification

On meeting either line, push a notification to the operator through whatever surface the client offers, `PushNotification` in this repository's client and one example among the surfaces a different client exposes.

- Name the worker, the branch, which line fired, and the dwell where `WORKER-STOPPED` carries one
- Send it once per stall, as `watch.ts` prints it once, rather than on every interval the row stays stopped

### The open bound

The alarm reaches the operator only through the controller's own read, so a controller mid-turn misses the line for as long as the turn runs, and a stopped controller never sees it. Neither case closes here, since the loop and the notification surface both live inside the session that has to be free to act.
