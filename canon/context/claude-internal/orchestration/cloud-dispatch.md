---
title: Cloud dispatch
description: The cloud build beside the local background worker, why the plan travels as text, why the claim reads pull requests, the hook that stages the VM, and the create wrapper stopgap
---

# Cloud dispatch

## Layout

### The shape

The orchestrator can hand a row to a Claude Code cloud session instead of a local `claude --bg` worker. The session clones the repository on a VM, builds under `auto-ship`, and opens a pull request on the `claude/` branch the cloud assigned.

- Recognizing that pull request as the row's and writing its number onto the task stay with the local orchestrator
- `orchestrator-cloud-launch.md` in the `role-orchestrator` skill holds the procedure, and `orchestrator-dispatch.md` holds when to pick it and how its claim reads

The pick stays the operator's per dispatch until three cloud rows have merged. The cloud credit expires on 2026-11-05 and is the reason to use the shape at all, and the review load a cloud pull request adds is unmeasured.

A row qualifies only when its plan carries no open question and touches nothing needing local state, being the sandbox, the records remote, or a browser.

## Decisions

### Why the plan travels as text

Records do not sync to the VM, and only the orchestrator writes the board. The VM has no `.canon/`, and `auto-ship` Step 1 would refuse a plan path it cannot read.

- The launch prompt carries the plan verbatim after `/auto-ship <plan>` and tells the worker to write it to that path first
- The folder stays gitignored on the VM, so the plan never reaches a commit
- The route is unmeasured. The sandbox spike committed `.canon/plans/` into its fixture, so the first end-to-end run settles it.

### Why the claim reads pull requests

A cloud worker never registers in `canon sessions list` and never pushes the branch `canon tasks plan-branch` derives, so all three readings of the local claim read clear on a row it holds. The claim reads each open `claude/` pull request's comments instead.

- It looks for an `ANNOUNCE:` or `QUESTION:` line naming `plan <slug>`, plus the session ids this pass launched, which cover the minutes before the pull request exists
- The slug rides in a comment because the launch prompt asks for it there. The title and body cannot carry it, since `git-pr` writes both from the diff.
- Recognition matches a commit's `Claude-Session:` trailer against the recorded session id, since the worker writes a comment and the harness stamps the trailer

A cloud worker cannot message the orchestrator without Remote Control. The pull request and an `ANNOUNCE:` comment are its announcement, and a stop on a question becomes a draft pull request with a `QUESTION:` comment. Every comment names the repository, since a cloud message reaches its reader with none attached.

### Staging the VM

A cloud session loads no plugin. `.claude/hooks/cloud-setup.sh` runs on `SessionStart` and exits at once unless `CLAUDE_CODE_REMOTE=true`. On the VM it copies `claude/skills/*` into `.claude/skills/` and runs `bun install && bun link`, so `canon` is the checkout's own CLI.

- Every path the hook writes goes into `.git/info/exclude`, since `.gitignore` would itself be a diff
- It copies from the checkout, not the published package, because rows build against `main`'s skills and the package trails `main`. A target needs the other answer (`feature-cloud-target-setup`).
- A copy landing after the session lists its skills is untested, since the spike committed its skills first and the worker might lack them

### The create wrapper

`claude --cloud` refuses without a terminal, so the create runs under `script` with a 150-second timeout and reads the session id off the `Created cloud session:` readout.

- A readout carrying no `session_` id is a failed create, and the dispatch falls back to the human launch rather than record a session that does not exist
- Any change to the interactive create screen breaks the wrapper
- `claude -p --cloud "<description>"` creating a session without a terminal would retire it. Nobody has made the billed probe, and `feature-cloud-session-create` replaces the wrapper anyway.

### GraphQL on the VM

The cloud session's GitHub proxy blocks GraphQL and serves REST, so `git-pr` converges through `gh api` against REST endpoints.

- The draft mark is the exception. REST has no draft field, so `auto-ship` marks through the `convertPullRequestToDraft` mutation, which runs only locally.
- On the VM the read-back reports ready, and the chain stops with the pull request already open.
- The harness appends a session link to every pull request body it touches, and `canon labels scan` rejects one by design.
- `git-pr` deletes any line carrying the link after its write, and the launch prompt tells the worker to check once more, since the harness can append after `git-pr` returns.
