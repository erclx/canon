---
title: Orchestrator review dispatch runbook
description: Which pull requests take a reviewer dispatched under role-reviewer, the model it runs on, when a UI reviewer goes beside it, and how the cross-branch pass per wave reaches each brief
---

Run this on every first pass, from `### The review dispatch` in the skill body. Review splits by what each side can see rather than by pass number. A dispatched reviewer holds one pull request and reads it deeper than this session can while holding a wave, and this session holds the wave and reads what no single pull request shows.

## Every pull request takes a reviewer

Dispatch every pull request's review to a reviewer under `role-reviewer`, first pass included, whatever its size or its paths. A release pull request is the one exception, since its sweep carries no findings and owes no pass.

- This session reviews nothing in place, since a warm pass reads the whole diff into the wave's one context and thins every later pull request's attention
- A cold session pays for its own context instead
- Nothing checks that a first pass was dispatched, so a pull request reviewed in place is a rule that went unread rather than a check that failed
- Pick the reviewer's model by `## Pick the model` in `orchestrator-dispatch.md`, the one source for every role this session launches

## The UI reviewer

A pull request whose evidence record carries a checklist takes a second reviewer, a UI reviewer under `review-ui`, dispatched beside the code reviewer so the two passes run at once. Read the record with `canon pr evidence <number> --json` and branch on its `checklist` field rather than on the exit code.

- A record carrying no checklist dispatches no UI reviewer, since the pass would stop on arrival
- The UI reviewer reads no diff and never hears the code verdict, so neither brief carries the other's result
- Each posts its own family and runs `canon pr lift` on its close, and the verb lifts the draft mark only once both read closed at the head

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

Take the reviewer shape in `orchestrator-reviewer-launch.md`, or its UI reviewer shape for a pull request carrying a checklist.

- Check `canon sessions list --json` first for a live `reviewer-<project>-<number>` or `reviewer-ui-<project>-<number>`, and message it instead of launching
- Two reviewers on one pull request post two verdicts
- The re-review after a worker's address pass reaches the reviewer from the worker, and this session sends it only as the fallback `orchestrator-handback.md` states

## Local or cloud

A code review goes to a cloud reviewer rather than `claude --bg` only on the operator's explicit pick for that dispatch, the same standing the build shape's pick holds in `orchestrator-dispatch.md`. A UI review always stays local.

- The cloud session costs no local context and no machine slot, which matters on a wide wave
- It reads nothing this machine holds, so a review needing the board, a local preview, or a sandbox stays local
- This session hears a cloud reviewer through `poll.ts` alone, so the posted review is the announcement and no message arrives
- `orchestrator-cloud-launch.md` carries the shape under `## Dispatch a review to a cloud reviewer`
