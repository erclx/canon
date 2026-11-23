---
title: Orchestrator merge order
description: Which branch of a wave merges first, the rebase each sibling owes after a merge, and the port each worker's server takes
---

# Merge order and ports

Part of `role-orchestrator`'s `## Parallelism`. The session reads this file before recommending a merge in a wave where two tracks share a file or two workers run a server.

Two tracks sharing a file both build, and the one merging second rebases and resolves in its own session after the first lands.

- Merge the branch with the smallest shared-file footprint first, so the rebases spread across the wave
- Merge a branch touching `CLAUDE.md`, a Claude context entry, or a regenerated `index.md` last
- Merge a review batch back to back in least-rebase order as each pass closes
- Have every sibling the merged diff touches rebase on the new `main` before the next merge
- Two workers running a server take a port apiece, derived from the worktree by `scripts/worktree-port.sh`. Read it, and set `WORKTREE_PORT_OFFSET` only when two worktrees derive the same one.

A standing authorization merges in this same order, one pull request at a time. The next waits until each sibling the last merge touched has rebased and its gates read clean again. A merge never waits on `🎬 E2E Suites`, which is informational.

Once a merge or a code close makes a deferred pull request next, have it rebase first. Then launch its UI reviewer and ask its worker to film the reel at the rebased head, per the deferral in `orchestrator-review-dispatch.md`.
