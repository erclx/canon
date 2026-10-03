---
title: Cloud dispatch
description: The cloud build shape beside the local background worker, why the plan travels as text, why the claim reads pull requests rather than the roster, the repository hook that stages the VM, and the create wrapper as a stopgap
---

# Cloud dispatch

## The shape

The orchestrator can hand a row to a Claude Code cloud session instead of a local `claude --bg` worker. That session runs on a VM that clones the repository from GitHub, builds under `auto-ship`, and opens a pull request on the `claude/` branch the cloud assigned it. Recognizing that pull request as the row's, and writing its number onto the task, stay with the local orchestrator. `orchestrator-cloud-launch.md` in the `role-orchestrator` skill holds the procedure, and `orchestrator-dispatch.md` holds when to pick it and how its claim reads.

The pick stays the operator's per dispatch until three cloud rows have merged. The cloud credit, which expires on 2026-11-05, is the reason to use the shape at all, and the review load a cloud pull request adds has not been measured. A row qualifies only when its plan carries no open question and touches nothing needing local state, being the sandbox, the records remote, or a browser.

## Why the plan travels as text

Records do not sync to the VM, and only the orchestrator writes the board. So the VM has no `.canon/`, and `auto-ship` Step 1 would refuse a plan path it cannot read. The launch prompt carries the plan verbatim after the `/auto-ship <plan>` command and tells the worker to write it to that path first. The folder stays gitignored on the VM as it is here, so the plan never reaches a commit.

The route is unmeasured. The sandbox spike committed `.canon/plans/` into its fixture, so `auto-ship` never had to read a plan the session wrote itself, and the first end-to-end run is what settles it.

## Why the claim reads pull requests

A cloud worker never registers in `canon sessions list` and never pushes the branch `canon tasks plan-branch` derives, so all three readings the local claim composes read clear on a row a cloud worker holds. The claim reads the open pull request list for a `claude/` head whose title or body names the plan slug instead, plus the session ids this pass launched, which cover the minutes before the pull request exists. Recognition then matches a commit's `Claude-Session:` trailer against the recorded session id, since a title is something the worker writes and the trailer is something the harness stamps.

A cloud worker cannot message the orchestrator without Remote Control, so the pull request and an `ANNOUNCE:` comment are its announcement, and a stop on a question becomes a draft pull request with a `QUESTION:` comment. Every comment names the repository, since a message from a cloud session reaches its reader with no repository attached.

## Staging the VM

A cloud session loads no plugin. `.claude/hooks/cloud-setup.sh` runs on `SessionStart`, exits at once unless `CLAUDE_CODE_REMOTE=true`, and on the VM copies `claude/skills/*` into `.claude/skills/`, links `.claude/standards` to `../standards` so the skills' `../../standards/` citations resolve, and runs `bun install && bun link` so `canon` is the checkout's own CLI.

Every path the hook writes goes into `.git/info/exclude` rather than `.gitignore`, which would itself be a diff, so no commit carries them. Copying from the checkout rather than installing the published package is deliberate here: this repository's rows build against `main`'s skills, and the published package trails `main` until a release cuts. A target needs the other answer, and `feature-cloud-target-setup` owns it.

The copied skills listing mid-session is untested. The sandbox spike committed its skills before the session started, so a hook copy that lands after the listing could leave the worker without them.

## The create wrapper

`claude --cloud` refuses without a terminal, so the create runs under `script` with a 150-second timeout and reads the session id off the `Created cloud session:` readout. Any change to the interactive create screen breaks the wrapper, so a readout carrying no `session_` id is a failed create and the dispatch falls back to the human launch rather than recording a session that does not exist. A `claude -p --cloud "<description>"` that creates a session with no terminal would retire the wrapper. Nobody has probed it, since the probe is a billed run, and `feature-cloud-session-create` replaces the wrapper with a verb either way.

## GraphQL on the VM

The cloud session's GitHub proxy blocks GraphQL and serves REST, so `git-pr` converges through `gh api` against the REST endpoints and reads the default branch the same way. The draft mark is the exception. REST's pull request update carries no draft field, so `auto-ship` marks the draft through the `convertPullRequestToDraft` mutation, which runs only locally. On the VM the mark fails, the read-back reports the pull request ready, and the worker's chain stops there with the pull request already open.

The harness also appends a session link to every pull request body it touches, and `canon labels scan` rejects one by design. `git-pr` reads the live body back after its write and deletes any line carrying the link, and the launch prompt tells the worker to check once more before finishing, since the harness can append after `git-pr` returns.
