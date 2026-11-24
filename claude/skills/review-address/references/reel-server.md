---
title: Reel server
description: The server check review-address runs before a fix push on a pull request whose evidence carries a reel, so the re-filmed reel lands at the new head or the skip names why
---

# Reel server

Read by Step 6 of `review-address` before the push, on a pull request whose evidence comment carries a reel.

`git-followup` re-runs `pr-evidence`, which re-films a reel only on an `ok` from the local step. A fix pushed with no server up leaves the old reel trailing the new head, and the lift refuses `reel-unsettled` until one lands.

## Check the server

Read what the comment carries, then the server, before the push:

```bash
canon pr evidence <number> --check --json
canon pr local --json
```

- Skip the server read when the check record carries no `reels`, since the lift owes no re-film there
- On `ok`, push as Step 6 states
- On any other reason, follow `### The preview server` in `role-worker`, which names the reasons that start one and the wait, then push whatever the verb reads after it

## A server that will not start

Never stop the push on a server that stays down. `pr-evidence` then posts a `no-server` skip naming the local reason, so the comment and the lift both carry the cause, and the next push with the server up re-films and drops it.
