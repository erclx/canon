---
title: Orchestrator review dispatch runbook
description: When a pull request's review leaves this session for a reviewer dispatched under role-reviewer, what stays in place below both triggers, and how the cross-branch pass per wave reaches each brief
---

Run this on every first pass, from `### The review dispatch` in the skill body. Review splits by what each side can see rather than by pass number. A dispatched reviewer holds one pull request and reads it deeper than this session can while holding a wave, and this session holds the wave and reads what no single pull request shows.

## The two triggers

Either one dispatches the pull request's review to a reviewer under `role-reviewer`, first pass included.

- Load. Three or more open pull requests awaiting a first pass, or one diff too large for this session to hold. Three is the operator's number, set by hand and marked as such so a measurement replaces it rather than argues with it. What counts toward it is a pull request awaiting a first pass rather than every open one, since a branch already closed out and waiting on a merge costs this session nothing. `orchestrator-poll.md` states where the count is legible.
- Content. The change touches `src/`, `scripts/`, a workflow, a hook, a skill or rule body, or a security surface, meaning anything that writes files, runs commands, pushes records, or handles transcripts. A skill or rule body counts as executable whatever its extension, since a model runs it. A pull request carrying an `## Evidence` comment with screenshots counts as well, since a reviewer holding one pull request opens every capture and a long-lived context rarely pays for that.

Nothing counts either trigger. This is prose this session applies to itself, on the same standing as the poll's own start condition, so a wave reviewed in place past both is a rule that went unread rather than a check that failed.

## What stays in place

Below both triggers this session runs `review-pr` itself: a change to `docs/` or a context entry, a wording sweep, a release or capture pull request, and anything this session can review in one read. A cold reviewer pays a full session context per pull request, which on a small prose change costs more than the warm pass it replaces.

## The cross-branch pass

This session keeps one pass per wave, whichever way each review went. It reads the file sets of every open pull request against each other, the board, and the merge order, and never the diffs themselves. What it looks for is what no single pull request shows: two branches regenerating one asset, several writing one context entry, a figure true only after another branch lands.

Hand what it finds to each reviewer as facts in the brief, per `### What the brief may carry` in `orchestrator-launch.md`, rather than posting a comment of its own, so each pull request keeps one live verdict. A fact surfacing after a reviewer posted goes to that reviewer as a re-review request.

## Launching the reviewer

Take the reviewer shape in `orchestrator-launch.md`. Check `canon sessions list --json` for a live `reviewer-<project>-<number>` first and message it instead of launching a second, since two reviewers on one pull request post two verdicts. The re-review after a worker's address pass goes back the same way, per `orchestrator-handback.md`.
