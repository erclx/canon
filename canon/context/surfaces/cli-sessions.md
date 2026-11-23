---
title: CLI sessions
description: '`src/pr/`, `src/listeners/`, and `src/sessions/`, being the `canon pr` readers and writers, the port listener reads, and the live-session roster with the branch claim'
---

# CLI sessions

## Overview

Owns `canon pr`, the port listener reads, and the live-session roster with the branch claim. The layers they stand on are in `cli.md`.

## Layout

### `src/pr/`

Holds the readers and writers behind `canon pr`, all over REST rather than GraphQL. The squash in `merge.ts` is a REST `PUT` pinned to the head it read, and a bot pull request composes from its own body.

- `rest.ts` is the one boundary where REST payloads take the field names the rest of the folder reads, and list endpoints go through `gh api --paginate`
- `head.ts` and `checks.ts` key on the remote tip, not the local branch, and `checks.ts` tells a conflicted branch from runs that have not started
- `evidence.ts`, `tick.ts`, `bijection.ts`, and `links.ts` own the marked comment, ticks, key-changes check, and its links. `frames.ts` files frames, captures, and reels on `canon/frames` until a prune
- `preview.ts` and `local.ts` write and remove the address line, read off the deploy trigger and off a declared port then the cwd. `drive-copy.ts` rebuilds a UI pass's copy and its own server
- `lift.ts` readies a pull request only when every gate passes, or returns a ready one to draft. `carry.ts` holds the push and rebase carries the tick shares, and the code review's merge carry

### `src/listeners/`

Holds the port listener reads and their `stop.ts`, shared by `pr local`, `worktrees reclaim`, and `sessions reap`.

- `machine.ts` reads through `/proc` first and lsof second, and reports no reader at all rather than an empty list on a machine with neither
- `parse.ts` turns each tool's output into pid and port pairs. `belongs.ts` is the nesting test that keeps a listener in the main checkout or a sibling worktree out of a worktree's set

### `src/sessions/`

Holds the live-session roster and the branch claim, split by what a stub has to replace. `transfer/` moves a session between machines and treats a transcript as opaque bytes. `reap.ts` judges each stop by a fresh roster read, and reads a pull request as landed from the local trunk alone, so a clone behind the remote keeps skipping a busy reviewer.

- `registry.ts` reads one JSON file per session under `claudeConfigDir()`. No published contract describes it, so an absent registry refuses rather than reporting an empty roster
- `live.ts` matches a record to its stamped start time, and marks it unverified where it can only probe a signal or, across pid namespaces, a socket file. `liveness()` stays synchronous for the gate
- `resolve.ts` joins a session to its branch, scoping `--branch` to the shared directory, and confirms a row `via: 'listener'` when its socket accepts, since macOS has no process filesystem
- `claim.ts` composes `claimed` from the roster, worktrees, and `branchRefs()`, which misses a branch pushed since the last fetch. Two readable flags stay apart so a failed read never reads unclaimed
- `stop.ts` reads a usage-limit stop off a transcript's last 1 MiB. No contract describes the entry, so a limit-worded one of another shape reads `unknown`

## Gotchas

- The pass's server writes to `server.log` rather than a pipe, since a pipe closes when `pr drive-copy` exits and takes the detached server down on its next write
- `pr merge` reads stale from the fork point through the lift's `readBaseReading`, never from the last CI run, so a branch sharing a file with a merged sibling updates first even when both edits pass
