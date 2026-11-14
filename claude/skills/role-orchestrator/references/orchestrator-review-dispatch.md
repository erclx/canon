---
title: Orchestrator review dispatch runbook
description: The painted-proof check every pull request clears before a reviewer launches, which pull requests take a reviewer dispatched under role-reviewer, the model it runs on, when a UI reviewer goes beside it, when small pull requests share one reviewer pair, and how the cross-branch pass per wave reaches each brief
---

Run this on every first pass, from `### The review dispatch` in the skill body. Review splits by what each side can see rather than by pass number. A dispatched reviewer holds one pull request and reads it deeper than this session can while holding a wave, and this session holds the wave and reads what no single pull request shows.

## Proof before any reviewer

A painted pull request missing proof goes back to its worker before any reviewer launches. Read it on every first pass, ahead of every launch below, and on every `MOVED` the poll routes here:

```bash
canon pr evidence <number> --check --json
```

Branch on the record's fields rather than on the exit code, and never derive the painted set from `gh pr diff` against a test written here, since the verb already reads it.

| Record                         | Route                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `uncaptured` lists paths       | Send it back for a capture and `pr-evidence`, naming each path as the record spells it     |
| `owed` holds `evidence`        | Send it back to run `pr-evidence`, since an evidence image changed and no comment shows it |
| `settled`, `uncaptured` empty  | Proof stands, so launch the reviewers below                                                |
| `uncaptured` absent            | The base keeps no captures, so route on `owed` alone and never send it back for a capture  |
| A refusal, such as `gh-failed` | Report the `reason`, launch the reviewers, and name the check unread in each brief         |

`owed` holding only `preview` is the ship chain's deploy wait rather than missing proof, so it holds no reviewer.

### Sending it back

Message the session holding the branch, resolved the way `## Sending the handback` in `orchestrator-handback.md` resolves it, with the paths and the skill to run. Hold both reviewers until a re-read reads proof, since a code review on a head about to gain captures runs twice.

- A worker reporting that no capture can be taken, such as a state no fixture reaches, releases the hold, so launch the reviewers
- Carry the uncaptured paths as a fact in the code reviewer's brief then, since only a review pass may write the waiver `canon pr lift` reads
- Re-read the check on the worker's reply or the next `MOVED`, never on a timer
- A refusal never reads as proof. `canon pr lift` reads the same record and holds the mark on its own gate, so a launch past an unread check costs no merge.

## Every pull request takes a reviewer

Dispatch every pull request's review to a reviewer under `role-reviewer`, first pass included, whatever its size or its paths. A release pull request is the one exception, since its sweep carries no findings and owes no pass.

- This session reviews nothing in place, since a warm pass reads the whole diff into the wave's one context and thins every later pull request's attention
- A cold session pays for its own context instead
- Nothing checks that a first pass was dispatched, so a pull request reviewed in place is a rule that went unread rather than a check that failed
- Pick the reviewer's model and effort by `## Pick the model` in `orchestrator-dispatch.md`, the one source for every role this session launches
- The code reviewer's pick reads the plan's weight there, since a miss on a heavy row is the one that ships unseen, and the UI reviewer's never does

## The UI reviewer

A pull request whose evidence record counts a drivable box takes a second reviewer, a UI reviewer under `review-ui`, dispatched beside the code reviewer so the two passes run at once. Read the record with `canon pr evidence <number> --json` and branch on `drivable` above zero rather than on the exit code.

- A record carrying no checklist dispatches no UI reviewer, since the pass would stop on arrival
- A record whose `drivable` reads zero, every box being `(taste)`, dispatches none either, while a `checklist` with no readable `drivable` dispatches one, as the lift binds on it
- A pull request that gains a drivable box in review takes its UI reviewer then, on the `MOVED` that brought it, since a first pass that read none launched nobody
- The UI reviewer reads no diff and never hears the code verdict, so neither brief carries the other's result
- Each posts its own family and runs `canon pr lift` on its close, and the verb lifts the draft mark only once both read closed at the head

## A batch of small pull requests

Small pull requests landing together can share one reviewer pair rather than taking a pair each. Rows stay one per fix, so only the review is batched, and this session decides the batch without asking the operator.

### The batch test

A pull request joins a batch only when every condition below holds. No size number decides, since a row the planner kept to one fix is already small.

- Its plan names no contract under `## Risks` that another track consumes
- It needs no design pick, and its Testing section names no billed run
- It opens in the same wave as every other pull request in the batch

A pull request failing any condition takes its own reviewer pair, as above. A row found touching a consumed contract after launch comes back from the batch reviewer. Launch it a fresh pair, leaving that reviewer out of the live check below, since its name still lists the number.

### One pair per batch

Launch one code reviewer for the whole batch, and one UI reviewer beside it when any batched evidence record carries a `drivable` count above zero. `orchestrator-reviewer-launch.md` carries both batch shapes.

- Each pull request still takes its own pass, its own verdict comment, and its own `canon pr lift`, since the poll routes on each comment's heading
- Never ask for one summary comment across the set, since a second comment is a second verdict the poll cannot route
- Name the batch and the test it passed in the dispatch report, so the operator can split it before the first pass posts
- `${CLAUDE_SKILL_DIR}/references/orchestrator-merge-order.md` states how a batch merges, and a pull request whose pass stays open waits for its own re-review while the rest merge

## The cross-branch pass

This session keeps one pass per wave beside the dispatched reviews. It reads the file sets of every open pull request against each other, the board, and the merge order, and never the diffs themselves.

- It looks for what no single pull request shows, such as two branches regenerating one asset, several writing one context entry, or a figure true only after another lands
- Hand what it finds to each reviewer as facts in the brief, per `### What the brief may carry` in `orchestrator-launch.md`, so each pull request keeps one live verdict
- A fact surfacing after a reviewer posted goes to that reviewer as a re-review request

## Ask for a named spend first

A pull request whose Testing section names a billed run waits on the operator's approval, and the rule for what counts as a spend sits in `### Human-only boxes` of `${CLAUDE_SKILL_DIR}/../git-pr/references/pr.md`. Put it to the operator before the first reviewer is dispatched, since asking after review leaves the branch rebasing while it waits.

- Take the spend from the worker's announcement, which carries it, and ask once
- Dispatch the reviewer beside the question rather than holding it for the answer, since a review pass does not depend on the billed run and the box is re-read on a later pass
- Ask nothing when the operator already cleared the spend or the pull request names none
- Send the answer to the worker, which drives the run and records what it returned in the box

## Launching the reviewer

Take the reviewer shape in `orchestrator-reviewer-launch.md`, or its UI reviewer shape for a pull request whose `drivable` count is above zero.

- Check `canon sessions list --json` first for a live `reviewer-<project>-` or `reviewer-ui-<project>-` session whose trailing numbers include `<number>`, and message it instead of launching
- Match a number among the trailing ones rather than the whole name, since a batch reviewer's name lists every pull request it holds
- Two reviewers on one pull request post two verdicts
- The re-review after a worker's address pass reaches the reviewer from the worker, and this session sends it only as the fallback `orchestrator-handback.md` states

## Local or cloud

A code review goes to a cloud reviewer rather than `claude --bg` only on the operator's explicit pick for that dispatch, the same standing the build shape's pick holds in `orchestrator-dispatch.md`. A UI review always stays local.

- The cloud session costs no local context and no machine slot, which matters on a wide wave
- It reads nothing this machine holds, so a review needing the board, a local preview, or a sandbox stays local
- This session hears a cloud reviewer through `poll.ts` alone, so the posted review is the announcement and no message arrives
- `orchestrator-cloud-launch.md` carries the shape under `## Dispatch a review to a cloud reviewer`
