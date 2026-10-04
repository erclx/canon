---
title: Orchestrator watch runbook
description: The long-running watch that reads pull requests and the session roster together, and the stall alarm it prints for a worker left waiting
---

Run the watch beside the poll when the dispatch fallback in `orchestrator-poll.md` is in force, or whenever a worker's exit has to be seen as well as its pull request. The poll classifies and routes, and this loop only reports.

## The watch beside it

`${CLAUDE_SKILL_DIR}/scripts/watch.ts` is a long-running loop rather than a scheduled prompt, started as `bun <path>`. It reads the open pull request list and the session roster together every sixty seconds and prints one line per new pull request, per worker whose name, branch, or status changed, and per worker that dropped out of the roster. Start it in the background and read what it emits. It writes nothing.

Coverage is what it buys over the poll. A worker that finishes goes idle and a worker that crashes disappears, so a trigger reading pull requests alone stays silent through the second, and the roster read is the half `poll.ts` cannot make. It ran a full afternoon over four concurrent workers and caught every transition, while the three-minute poll it replaced reported no movement five times in a row.

It classifies nothing and routes nothing. A line it prints says a pull request opened or a worker moved, and the routing block in `orchestrator-poll.md` is still what decides whether a review follows, so the two compose rather than replace each other.

Every session in the repository holding a branch other than the base one counts as a worker, whoever launched it. The prototype matched the `orchestrator-` prefix instead, which reads a dispatched worker and misses every hand-launched one. A failed read of either source reports itself on a `watch:` line and leaves the baseline untouched, since reading an empty result as current state would report every worker gone on the pass after.

## The stall alarm

`watch.ts` prints `WORKER-STOPPED <name> <branch> <dwell>s` once a `waiting` row crosses `STALL_THRESHOLD_S`, and `WORKER-UNMEASURABLE <name> <branch>` for one whose record carries neither timestamp the dwell falls back to. Both are prints, not alerts, so the operator learns of one only when a session already reading the loop's output relays it further. The toolkit ships no notification verb, since the surface a stall reaches the operator through is a session tool rather than a command a shell loop can call.

The two lines carry different confidence and the push has to say so rather than treat them as one signal. `WORKER-STOPPED` fires only once the dwell has already crossed the threshold, so it reports a wait already confirmed long. `WORKER-UNMEASURABLE` has no dwell to threshold on, so it fires on the first pass that meets a `waiting` row carrying neither stamp, whether that row has sat five seconds or fifty minutes.

On meeting either line, push a notification to the operator through whatever notification surface the client offers, `PushNotification` in this repository's client and one example among the surfaces a different client exposes. Name the worker, the branch, which of the two lines fired, and the dwell where `WORKER-STOPPED` carries one, and send it once per stall the same way `watch.ts` prints it once, rather than repeating it on every interval the row stays stopped.

The bound stays open. The alarm reaches the operator only through the controller's own read, so a controller mid-turn does not see the line for as long as the turn runs, and a controller that is itself stopped never does. Neither case closes here, since the watch loop and the notification surface both live inside the same session that has to be free to act on either.
