---
title: Drive a throwaway copy
description: Steps 4 and 7 of review-ui, which rebuild the copy a preview saves into before the browser opens and check the worker's worktree for a tracked change before the post
---

# Drive a throwaway copy

Steps 4 and 7 of `review-ui`. A preview that saves what the pass drives would otherwise write the worker's tracked files, and a drag would land in a committed fixture.

A project names the folders its preview writes in `canon/config/preview.json`. The worker starts its server reading a copy of them, and the pass rebuilds that copy at every head so the last pass's drags never reach this one.

## Before the browser opens

Rebuild the copy and record the worktree's state:

```bash
canon pr drive-copy <number> --baseline --json
```

Branch on `reason` rather than on the exit code.

- `copied` means the address serves a throwaway copy rebuilt from the worker's worktree. Keep `copied` for the comment.
- `no-config` means the project declares no preview writes, so drive as usual. The check below still runs.
- `no-worktree` means no local worktree holds the branch, as for a cloud worker's. Drive, and say in the comment that the worktree check did not run.
- Any other refusal stops the pass with nothing posted, naming the `reason` and `message` for the dispatcher, since a broken `canon/config/preview.json` would send the drives into the real folders

## Before the post

At the start of Step 7, with the browser closed since Step 6, read whether the drives changed anything git tracks in the worker's worktree:

```bash
canon pr drive-copy <number> --check --json
```

- `clean` continues with the post
- `changed` stops the pass. Step 7 posts it open with every path in `paths` named, and Step 8 ticks nothing, since the boxes ran against a tree the drives rewrote.
- Leave each changed path as it stands. The worktree is the worker's, so the pass reports a change and never reverts it.
- A refusal, `no-worktree` and `no-baseline` among them, means the check did not run. Say so in the comment rather than reading it as clean.
