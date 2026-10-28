---
title: Isolating the drive
description: Step 1 and the close of app-drive, covering the detached worktree outside the repository, the build and serve inside it, the address check, the removal, and the recovery after a crash
---

# Isolating the drive

Read on reaching Step 1 of `app-drive`, again at its close, and whenever a reading returns nothing it should. The copy is a detached worktree of the commit being driven, made outside the repository, so the whole tree is the copy and every write the drive makes lands there.

## Make the copy

Run each command from the main worktree root.

1. Run `git worktree prune` first, which drops the registration a crashed drive left behind once its folder is gone.
2. Make a folder with `mktemp -d`, outside the repository, and add the worktree with `git worktree add --detach <dir>/app <commit>`. The commit is the tag or sha the operator names, or the trunk's tip.
3. Record the commit, the folder, and the launch command as rows of the drive log's setup table, in the shape `drive-record.md` sets.
4. Put the worktree's path in `drive.json` as `worktree`, so the check fails a drive whose close never removed it.

A folder under the repository is the wrong home. The parent repository becomes the app's repository root, and a walk-up search for config or a lockfile finds the project instead of the copy.

## Build and serve

- Install and build inside the worktree with the config's `launch` command. Nothing the build writes reaches the project, since the copy has its own working tree.
- Copy the config's `data` fixture into place inside the worktree before serving, never served from where the project tracks it
- Start the server in the background from the worktree, and never detach it with `nohup`, `setsid`, or `disown`, since this session is the stop
- Read the address with `canon pr local --root <worktree> --json`. A bare `canon pr local` from the main checkout never sees the copy and can report an unrelated server.
- Run `git -C <worktree> status --porcelain` after a step that should write, to list what the drive wrote in the copy

## Traps

- Restart a server after rebuilding what it serves. A server started inside an output folder the rebuild replaced keeps serving a deleted directory, and every selector comes back empty.
- Serve the built artifact the way the host resolves it. A plain file server can answer a clean route the host rewrites with a 404, such as `/about` for `about.html`.
- Rebuild from the named commit when the operator moves it mid-drive, and log the change. A stale build reports on code that no longer ships.
- Note what a build cannot show, such as live timing a recorded build lacks or recompile pauses a dev server adds. Neither is a finding.

A target whose build cannot run outside its repository, such as one linking sibling packages by relative path, refuses this recipe. Report it to the operator rather than building inside the main checkout.

## Close

Close only after every cited frame sits in the intake folder's `evidence/`, and every drawn finding's mock source in `evidence/mocks/`, since the removal deletes whatever scratch the worktree held.

1. Stop the server this session started.
2. Run `git worktree remove --force <dir>/app`, then remove `<dir>`.
3. Confirm with `git worktree list` that the copy is gone, then run `canon intake drive-check <slug> --json`.

`canon worktrees reclaim` skips a detached worktree, so nothing else removes the copy. A session that crashed before its close leaves the folder for the system's temp sweep and the registration for the next drive's prune.
