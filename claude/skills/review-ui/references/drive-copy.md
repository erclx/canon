---
title: Drive a throwaway copy
description: Steps 4 and 7 of review-ui, which rebuild the copy a preview saves into and start the pass's own server on it before the browser opens, then stop that server and check the worker's worktree for a tracked change before the post
---

# Drive a throwaway copy

Steps 4 and 7 of `review-ui`. A preview that saves what the pass drives would otherwise write the worker's tracked files, and a drag would land in a committed fixture.

A project names the folders its preview writes in `canon/config/preview.json`. The worker starts its server reading a copy of them, and the pass rebuilds that copy at every head so the last pass's drags never reach this one.

- The rebuild resets each declared `writes` path from the worktree and leaves the rest of the copy root alone
- A `keep` path inside a declared path is state the server owns, so the rebuild neither clears it nor copies the worktree's own
- The rebuild then runs the project's `seed`, when the config declares one, so state the project lays into the copy is back on every rebuild with no hand step
- A page added only to the copy and laid by no seed is gone after the rebuild, so a box can open only a page the worker committed under a declared path or the seed lays
- The seed is the worktree's own script, run from that tree against the copy. The operator accepted that trade over a snapshot the worker would have to refresh by hand.

### The pass's own server

A server keeps the files it already opened, so a database or a dependency cache rebuilt under the worker's running server answers 500 or stalls. A project that declares `serve` in the config gets a fresh server per pass instead.

- The verb starts it on the rebuilt copy at the worktree's port band plus 25, so it never meets the worker's port
- The worker's server is never stopped or restarted, since it belongs to another session
- It stands in for the local rung alone, and stops before the post, whatever the verdict
- A project with no `serve` key drives the worker's server exactly as before

### Which rung it serves

Pass `--serve` only when Step 3 took the local rung. A hosted rung passed its head check, and a launch-named address is the dispatcher's choice, so the pass drives either as Step 3 picked and runs the command below without `--serve`.

A pass reaching no rung goes to Step 7 as Step 3 states, since the worker's server answering is what shows the head is served at all. The post names the started `url` as the local rung, so it reads as a local preview, unverified, per `post.md`.

## Before the browser opens

Rebuild the copy, record the worktree's state, and start the pass's server on the local rung:

```bash
canon pr drive-copy <number> --baseline --serve --json
```

Branch on `reason` rather than on the exit code.

- `copied` means the address serves a throwaway copy rebuilt from the worker's worktree. Keep `copied` for the comment.
- `copied` carrying `url` means the pass's own server answers on the copy. Drive that `url` for every box, in place of the local rung's address.
- `no-config` means the project declares no preview writes, so drive as usual. The check below still runs.
- `no-worktree` means no local worktree holds the branch. Drive, and say in the comment that the worktree check did not run.

### Refusals that stop the pass

Any other refusal stops the pass with nothing posted, naming the `reason` and `message` for the dispatcher, since a broken `canon/config/preview.json` would send the drives into the real folders.

- `seed-failed` and `seed-wrote-worktree` mean the copy lacks its seeded pages, or the seed wrote the tracked files `paths` names
- `serve-failed` means the server never came up, so nothing fresh is left to drive. Name `serve.cause` and the `serve.output` tail.

A binary that rejects `--serve` as an unknown option predates the pass's server. Re-run the command without it, drive the Step 3 address, and say in the comment that the pass drove the worker's server.

### Load one page before box 1

When the record carries `url`, open it in the browser before the first box and read whether the page loads. A 5xx, an error overlay, or a page still blank after the browser's load wait reads as stale.

- Stop the pass with nothing posted on a stale page, run the stop below, and tell the dispatcher `preview-stale` with what the page showed
- Name a restart as the remedy, since the next pass's `--serve` starts the server fresh on a fresh copy
- Treat a `preview-stale` refusal from the verb the same way, naming its `path` and `status`. The verb already stopped the server, and `stopped` reads whether it ended.

## Stop the pass's server

Run the stop on every path out of a pass that started a server, being the post, a stale page, and any stop after `--serve` returned `url`:

```bash
canon pr drive-copy <number> --stop --json
```

- `stopped` and `not-running` continue
- `stop-failed` means the group survived, so name its `pid` and `port` in the comment, or in the stop message when nothing is posted, and leave it for the dispatcher
- Any other refusal, such as `gh-failed`, left the server up. Name the `reason` with the `pid` and `port` the `--serve` record carried, the same way.

## Before the post

At the start of Step 7, with the browser closed since Step 6, run the stop above first, so the server writes nothing after the read. Then read whether the drives changed anything git tracks in the worker's worktree:

```bash
canon pr drive-copy <number> --check --json
```

- `clean` continues with the post
- `changed` stops the pass. Step 7 posts it open with every path in `paths` named, and Step 8 ticks nothing, since the boxes ran against a tree the drives rewrote.
- Leave each changed path as it stands. The worktree is the worker's, so the pass reports a change and never reverts it.
- A refusal, `no-worktree` and `no-baseline` among them, means the check did not run. Say so in the comment rather than reading it as clean.
