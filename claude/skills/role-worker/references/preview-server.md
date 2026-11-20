---
title: The preview server
description: How a worker starts and owns the preview server a painted pull request needs, the drive copy it serves from, and where fixture state is laid
---

A painted pull request needs a server in this worktree for `canon pr local` to find, and this session is the one with a lifetime to own it. `auto-ship` Step 5 decides whether the diff is painted, so this reference restates no file test.

- Run `canon pr local --json` first. Start nothing on `ok`, `unhealthy`, or `invalid-config`, and carry a refusal's `message` in the announcement
- Otherwise start the stack's `dev` in the background from the worktree root before the pull request step, so a `review-address` fix shows on the same link.
- Wait up to 60 seconds for the verb to read `ok`, then ship either way. A stack with no `dev` script gets no start, and `pr-evidence` reports `no-server`.
- Never detach it with `nohup`, `setsid`, or `disown`, since the owning session is the stop. `canon sessions reap` and `canon worktrees reclaim` each end a listener it leaves behind.

Run `canon pr drive-copy --json` before starting `dev`. On `copied`, start it with `env` set to `copyRoot`, so the operator's address serves the copy. On `no-config`, start it as it is. On a refusal, start nothing and send the controller the `reason`, since a broken config would send drives into tracked folders.

- Lay fixture state through the `seed` key in `canon/config/preview.json`, which every rebuild runs against the copy
- Never seed by hand or into the worktree, where `--check` reads the write as a drive's

A hand-run `git-ship` or `git-pr` starts no server, since only a worker has a lifetime to own one.
