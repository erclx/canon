---
title: Orchestrator cloud launch
description: The cloud build and review shapes, being the launch prompt that carries the plan as text and announces over GitHub, the reviewer prompt whose posted review is its announcement, the create under a pseudo-terminal with its trust keys, and the readout that fails loudly on a missing session id
---

# Orchestrator cloud launch

Run this once `orchestrator-dispatch.md` has cleared a row and picked cloud for it. The worker runs on a Claude Code cloud VM that clones the repository from GitHub, loads no plugin, and cannot see this machine's `.canon/`.

The shape needs a `SessionStart` hook in the repository that, on the VM alone, copies the plugin skills into `.claude/skills/` and puts `canon` on the path.

- A repository without one cannot take this shape, so fall back to a local worker there
- Where the hook exists, the prompt calls `/auto-ship` with no `canon:` prefix, since the copied skills list as project skills

## Contents

- [Check the row is unclaimed](#check-the-row-is-unclaimed)
- [The prompt](#the-prompt)
- [The create](#the-create)
- [Recognize the pull request](#recognize-the-pull-request)
- [Dispatch a review to a cloud reviewer](#dispatch-a-review-to-a-cloud-reviewer)

## Check the row is unclaimed

A cloud worker never appears in `canon sessions list` and never pushes the derived branch, since the cloud assigns it a `claude/` branch of its own, so the roster and the refs read clear on a row it is building.

Run the local check in `orchestrator-dispatch.md` anyway, since a local worker on the same row still collides, then read the two places a cloud worker does show:

```bash
prs=$(gh api 'repos/{owner}/{repo}/pulls?state=open&per_page=100' --jq '.[] | select(.head.ref | startswith("claude/")) | .number') || { echo 'unreadable: the open pull request list'; exit 1; }
found=$(printf '%s\n' "$prs" | while IFS= read -r n; do
  [ -n "$n" ] || continue
  bodies=$(gh api "repos/{owner}/{repo}/issues/$n/comments" --jq '.[].body') || { echo "unreadable: the comments on #$n"; exit 1; }
  if printf '%s\n' "$bodies" | grep -qE '^(ANNOUNCE|QUESTION): plan <slug>([^a-z0-9-]|$)'; then echo "claimed: #$n"; fi
done) || { printf '%s\n' "$found" | grep '^unreadable'; exit 1; }
printf '%s\n' "${found:-clear}"
```

The prompt below has the worker open its `ANNOUNCE:` and `QUESTION:` comments with `plan <slug>`, so the comment is where a cloud pull request names its row. A title or body cannot, since `git-pr` writes both from the diff. Ending the match at a character no slug carries keeps `log` from claiming `log-entry`.

Branch on the line it prints rather than on the exit, which a shell function wrapping a command can flatten to zero:

- `claimed: #<n>`: a cloud worker's pull request names the plan slug. Treat the row as claimed and report each number.
- `clear`, and this pass's launched record holds no cloud session for the row: the row is clear of cloud workers.
- `unreadable: <what>`: nothing was checked, so treat the candidate as unverified and fall back to the human-launch line, as for a refused local check
- Never read `unreadable` as clear, since an empty answer from a failed read is the collision this check exists to catch

The launched record covers the minutes before the pull request opens, when nothing on GitHub names the row yet. It is this session's alone, so a second dispatcher sees only the pull request list, which is the window `orchestrator-dispatch.md` already states for local workers under `## Hold what this pass already launched`.

## The prompt

Write the prompt to `.canon/tmp/cloud-<slug>/prompt.md` at the main worktree root, with the command at position zero, per `### Position zero` in `orchestrator-launch.md`:

```plaintext
/auto-ship .canon/plans/feature-<slug>.md
Before Step 1 reads it, write the plan below verbatim to .canon/plans/feature-<slug>.md, creating the folder. That folder is gitignored, so it stays out of every commit. Stay on the branch this session was given, since a cloud session may push only to its own claude/ branch, so skip the worktree entry and the branch rename, and open the pull request from that branch although its name does not follow the branch convention git-pr checks.
Your controller cannot receive a message from this session. Announce on GitHub instead, naming the repository <owner>/<repo> in every comment. When the pull request opens, comment on it starting with ANNOUNCE: plan <slug>, then the number, the branch, the head sha, the CI state, and every point you departed from the plan on. If the chain stops after the pull request opens, post that comment anyway and name the stop. If you stop on a question before a pull request exists, push what you have, open a draft pull request through the REST create with draft=true, since the draft mark cannot run here, and comment on it starting with QUESTION: plan <slug>.
Before you finish, read the pull request's live body and delete every line carrying claude.ai/code/session_, since the label scan fails on one.
<the plan file, verbatim>
```

The plan travels as text because the VM has no `.canon/` and the orchestrator alone writes the board, so nothing syncs the record across. `auto-ship` Step 1 then reads it at the path the command names, the same as on a local worker.

## The create

`claude --cloud` refuses without a terminal, so the create runs under `script`, which supplies one:

```bash
dir=.canon/tmp/cloud-<slug>
timeout 150 script -qec "claude --cloud \"\$(cat $dir/prompt.md)\"" "$dir/create.typescript" < <(sleep 30)
session=$(grep -A 2 'Created cloud session:' "$dir/create.typescript" | grep -o 'session_[A-Za-z0-9]*' | head -n 1)
[ -n "$session" ] || { printf 'No cloud session id in %s. Nothing was dispatched.\n' "$dir/create.typescript" >&2; exit 1; }
printf 'session=%s\n' "$session"
```

Run it from the main worktree root, since the session targets whichever repository that checkout's `origin` names. That folder is already trusted, so the create screen shows no trust prompt.

- From an untrusted checkout, such as a fresh clone of another repository, the screen asks first, and piped keys answer it
- Replace `<(sleep 30)` with `<(sleep 4; printf '\033[B'; sleep 1; printf '\r'; sleep 30)` there
- Either way stdin stays open for the create, the measured shape, since an early end of input can reach the terminal before the screen settles

### The readout

The readout is the text `Created cloud session: <title>`, unanchored since a terminal capture can open a line with escape codes, followed by a `View:` address carrying the `session_...` id. Anything else is a failed create, including a run that exits zero.

- On a failed create, report the typescript's last lines and fall back to the human-launch line in `orchestrator-dispatch.md`
- The wrapper is a stopgap any change to the interactive create screen breaks, which is why the readout fails loudly instead of guessing
- Record `session` beside the row's branch in this pass's launched record, since that and the pull request list are the only readings that know it exists
- Name it on the row's task with `canon tasks session "$session" <task> --name cloud-<project>-<slug> --json`, since a cloud worker has no board and the roster never lists it
- Report the dispatch as the local shape does, naming the row, the plan, the repository, and the session id in place of a session name

## Recognize the pull request

A cloud worker cannot message this session and never appears in the roster `watch.ts` reads, so its pull request and its `ANNOUNCE:` comment are the announcement. Start the poll in `orchestrator-poll.md` when the cloud dispatch goes out, rather than at its thirty-minute fallback.

A pull request on a `claude/` head is this row's when one of its commits carries a `Claude-Session:` trailer naming the session id the create recorded:

```bash
gh api 'repos/{owner}/{repo}/pulls/<number>/commits' --jq '.[].commit.message' | grep -c 'Claude-Session:.*<session>'
```

A count above zero matches the row. A count of zero is someone else's pull request, whatever its title says. Once it matches, record the number on the row's task yourself with `canon tasks pull-request <number> <task>`, since `git-pr` on the VM has no task file to write, then review it the way step 5 reviews any worker's pull request.

## Dispatch a review to a cloud reviewer

Run this once `orchestrator-review-dispatch.md` has sent a code review to a dispatched reviewer and the operator picked cloud for it. A UI review never takes this shape, because it drives a browser the VM does not have.

- The reviewer needs the same `SessionStart` hook as the build shape
- It needs a `canon` on the VM whose `pr` reads run on REST, since the proxy refuses GraphQL

### Confirm the REST reads

Confirm the VM's `canon` reads over REST before dispatching. In this repository the setup hook links the checkout's own CLI, so a pushed branch carries the reads.

- Any other repository's VM installs `canon` from npm, so its `pr` reads run on REST only once a release carrying them is published
- Its copied skills carry the REST lookups only once that repository's skills are re-scaffolded from that release
- Read `npm view @erclx/canon version` against the first release whose changelog names the REST reads
- Run `grep -rnE 'gh pr (list|view|review|diff|comment)'` over the target's copied `review-pr` and expect no output
- A version short of that release, or a hit, dispatches a reviewer that fails on its first GraphQL call, so take the local shape instead

### Before the create

Check this pass's launched record for a cloud reviewer already holding the number, and run `canon pr review-state <number> --json` for a pass already posted. A cloud reviewer never appears in `canon sessions list`, so the local shape's live-session check reads clear on one.

The create targets whichever repository the checkout it runs from names as `origin`.

- For a pull request in this repository, write the prompt to `.canon/tmp/cloud-review-<number>/prompt.md` at the main worktree root and create there
- For another repository, run the create from its checkout and write the prompt under that checkout's own `.canon/tmp/cloud-review-<number>/`
- That checkout's `.gitignore` has to cover the folder before the create runs
- A fresh clone made for this is untrusted, so the create takes the trust-prompt key variant under `## The create`:

```plaintext
/role-reviewer
Then run /review-pr <number> on <owner>/<repo>.
Your controller cannot receive a message from this session. The review you post is the announcement, so post nothing else for it. If you stop on a question before the review posts, comment on the pull request starting with QUESTION: review <number>.
<the cross-branch facts>
```

The cross-branch facts are the ones `### What the brief may carry` in `orchestrator-launch.md` allows a reviewer brief, and nothing of this session's own read. Neither skill carries the invocation flag, so no position-zero expansion is at stake and the bare names reach the copied project skills.

### Create and record

Create the session with the wrapper under `## The create`, setting `dir` to that prompt's folder, and keep its readout rule, so no `session_` id means nothing was dispatched.

- Record the session id beside the number in this pass's launched record, and name the number, the repository, and the session id in the report
- `poll.ts` reads every open pull request's review state from this machine, so the posted `## Review` reaches the next poll like a local reviewer's
- Start the poll when the dispatch goes out rather than at its fallback
- A `QUESTION: review <number>` comment reaches the same poll as an unclassified reply, so answer it on the pull request

### Checking the transcript

The pull request is the record to act on, and the transcript is read back only to check for a refused call. Search the capture for `HTTP 403` and `graphql`, and report a hit as a finding naming a call still on GraphQL rather than reading the review as clean.

- Run `claude --teleport <session>` under `script` from a throwaway clone of the target outside this repository
- Answer its trust prompt with the same piped keys
- Set the terminal to 500 rows first, since only the screen tail is captured otherwise

### What a cloud reviewer cannot do

A cloud reviewer cannot be messaged after it posts, and it cannot message the worker either. `poll.ts` reports nothing when a code review posts on an unchanged head, so the poll's cloud-reviewer rule reads `canon pr review-state <number> --json` on every run for each pull request one holds.

- That read sends the `review-address` dispatch from this session when it shows an open pass
- A re-review after the worker's address pass is a fresh dispatch, local or cloud by the same pick
- It cannot lift the draft mark, since `canon pr lift` writes through the GraphQL mutation the proxy refuses, so leave the lift out of its prompt
- The same per-run read runs the verb from this session once the review reads closed at the head on a pull request still a draft
- A local reviewer whose run refused reports that in its close message, which reaches loop step 6 rather than the poll
