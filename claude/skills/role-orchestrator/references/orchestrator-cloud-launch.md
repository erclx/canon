---
title: Orchestrator cloud launch
description: The cloud build shape, being the launch prompt that carries the plan as text and announces over GitHub, the create under a pseudo-terminal with its trust keys, and the readout that fails loudly on a missing session id
---

# Orchestrator cloud launch

Run this once `orchestrator-dispatch.md` has cleared a row and picked cloud for it. The worker runs on a Claude Code cloud VM that clones the repository from GitHub, loads no plugin, and cannot see this machine's `.canon/`.

The shape needs a `SessionStart` hook in the repository that, on the VM alone, copies the plugin skills into `.claude/skills/` and puts `canon` on the path. A repository without one cannot take this shape, so fall back to a local worker there. Where the hook exists, the launch prompt calls `/auto-ship` with no `canon:` prefix, since the copied skills list as project skills.

## The prompt

Write the prompt to `.canon/tmp/cloud-<slug>/prompt.md` at the main worktree root, with the command at position zero, per `### Position zero` in `orchestrator-launch.md`:

```plaintext
/auto-ship .canon/plans/feature-<slug>.md
Before Step 1 reads it, write the plan below verbatim to .canon/plans/feature-<slug>.md, creating the folder. That folder is gitignored, so it stays out of every commit. Stay on the branch this session was given, since a cloud session may push only to its own claude/ branch, so skip the worktree entry and the branch rename, and open the pull request from that branch although its name does not follow the branch convention git-pr checks.
Your controller cannot receive a message from this session. Announce on GitHub instead, naming the repository <owner>/<repo> in every comment. When the pull request opens, comment on it starting with ANNOUNCE:, carrying the number, the branch, the head sha, the CI state, and every point you departed from the plan on. If the chain stops after the pull request opens, post that comment anyway and name the stop. If you stop on a question before a pull request exists, push what you have, open a draft pull request, and comment on it starting with QUESTION:.
Before you finish, read the pull request's live body and delete every line carrying claude.ai/code/session_, since the label scan fails on one.
<the plan file, verbatim>
```

The plan travels as text because the VM has no `.canon/` and the orchestrator alone writes the board, so nothing syncs the record across. `auto-ship` Step 1 then reads it at the path the command names, the same as on a local worker.

## The create

`claude --cloud` refuses without a terminal, so the create runs under `script`, which supplies one:

```bash
dir=.canon/tmp/cloud-<slug>
timeout 150 script -qec "claude --cloud \"\$(cat $dir/prompt.md)\"" "$dir/create.typescript" </dev/null
session=$(grep -A 2 'Created cloud session:' "$dir/create.typescript" | grep -o 'session_[A-Za-z0-9]*' | head -n 1)
[ -n "$session" ] || { printf 'No cloud session id in %s. Nothing was dispatched.\n' "$dir/create.typescript" >&2; exit 1; }
printf 'session=%s\n' "$session"
```

Run it from the main worktree root, since the session targets whichever repository that checkout's `origin` names. That folder is already trusted, so the create screen shows no trust prompt. From a checkout this machine has not trusted, such as a fresh clone of another repository, the screen asks first, and piped keys answer it: replace `</dev/null` with a pipe from `(sleep 4; printf '\033[B'; sleep 1; printf '\r'; sleep 30)`.

The readout is the text `Created cloud session: <title>`, unanchored since a terminal capture can open a line with escape codes, followed by a `View:` address carrying the `session_...` id. Anything else is a failed create, including a run that exits zero. Report the typescript's last lines and fall back to the human-launch line in `orchestrator-dispatch.md` rather than recording a session that does not exist. The wrapper is a stopgap: any change to the interactive create screen breaks it, which is why the readout fails loudly instead of guessing.

Record `session` beside the row's branch in this pass's launched record. A cloud worker never registers in `canon sessions list`, so that record and the pull request list are the only two readings that know it exists. Report the dispatch the way the local shape does, naming the row, the plan, the repository, and the session id in place of a session name.

## Recognize the pull request

A cloud worker cannot message this session and never appears in the roster `watch.ts` reads, so its pull request and its `ANNOUNCE:` comment are the announcement. Start the poll in `orchestrator-poll.md` when the cloud dispatch goes out, rather than at that runbook's thirty-minute fallback. A pull request on a `claude/` head is this row's when one of its commits carries a `Claude-Session:` trailer naming the session id the create recorded:

```bash
gh api 'repos/{owner}/{repo}/pulls/<number>/commits' --jq '.[].commit.message' | grep -c 'Claude-Session:.*<session>'
```

A count above zero matches the row. A count of zero is someone else's pull request, whatever its title says. Once it matches, record the number on the row's task yourself with `canon tasks pull-request <number> <task>`, since `git-pr` on the VM has no task file to write, then review it the way step 5 reviews any worker's pull request.
