---
title: Orchestrator poll lines
description: Which poll lines end a wait, what CODE-CLOSED and HELD mean, and where each routes
---

Read this when the poll exits on a line the routing block in `orchestrator-poll.md` does not cover, or to learn why a wake carried nothing to act on.

# Poll lines

A `--wait` run ends on a line that routes to an act and holds every other line for the next exit, since a wake over a line nobody acts on costs a turn over the whole context.

## What ends a wait

- `READY`, `CONFLICT`, `STALE`, `OVERLAP`, `EVIDENCE`, `UI-CLOSED`, `CODE-CLOSED`, and `UNMATCHED` end it
- A `poll:` line is reported as it always was, a failed read holding to the cap rather than ending the wait
- `OPENED`, `SEEN`, `MOVED`, `REBASED`, `RESPONSE`, `STALLED`, `UI-OPEN`, `UI-STALE`, and `GONE` are held, printed with the next exit, and printed at the cap when nothing actionable came
- A held line is already in the baseline, so it waits in `.canon/tmp/pr/poll/held.txt` until a run prints it, which a wait stopped early still honors, and the run with no `--wait` prints every line
- `HELD      <n> line(s) above ended no wait` closes an exit that carried held lines, and it asks nothing

## Reading a held line

A held line routes by its own rule in the block, a wake later than the pass that posted it.

- A held line waits at most the 1200 second cap by choice, since the worker's message reaches the reviewer and the controller reaches the rest, and `held.txt` keeps it until printed
- An `OPENED` with no live reviewer waits for the next exit, at most the wait cap, since the script reads no roster. The worker's announcement already starts the reviewer.
- A `MOVED` waits the same way, since the re-review request comes from the worker's message

## CODE-CLOSED

`CODE-CLOSED #<number> at <head>` prints when a pull request's code review moves to closed, once for each close. A first sighting prints `SEEN` rather than this line.

- A UI review still held, or a reel owed, is the case it exists for, since no other line prints on a code close behind it
- On a deferred pull request, check the deferral per `### Deferred behind an OVERLAP` in `orchestrator-review-dispatch.md`, and tell its worker to film when it is next
- On a pull request with a drivable box and a worker waiting on this close, message that worker to film
- Otherwise report it and stop, since a close with nothing owed needs no act
