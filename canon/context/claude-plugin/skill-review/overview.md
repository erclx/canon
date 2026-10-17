---
title: Overview
description: What the review paths cover, why no version-sequencing surface exists, how a routing decision is asserted
---

# Overview

## Overview

This folder covers how a change is reviewed once it exists. That is the pull request review `review-pr` posts and re-posts, the headings a poll routes on, the lenses a pass reads the description through, and the worker's half of the channel that answers a review.

## Layout

- `claude/skills/review-pr/` owns the pull request review and the heading set every other surface cites
- `claude/skills/review-craft/` owns what a review looks for and the evidence bar, which both review procedures load
- `claude/skills/review-address/` owns the worker's return leg, including the rebase stage
- `claude/skills/role-orchestrator/scripts/` owns `poll.ts` and `watch.ts`, which route on the headings
- `src/pr/` owns the `canon pr` verbs a pass reads the head, the marker, and the key changes through

Each file covers one part of the loop.

- `criteria.md` covers why criteria split from procedure and why security and rendered output are references
- `two-pass.md` covers the first pass, the close-out, the body file name, and the recorded commit
- `headings.md` covers the heading contract, the set the poll routes on, and the one threshold
- `lenses.md` covers the lenses that read the pull request body rather than the diff
- `worker.md` covers the rebase stage, the worker role, the channel split, and the relay

## Decisions

### No version-sequencing surface

`role-orchestrator` and `review-pr` each read the `Waiting on` cell of `.canon/tasks/priority.md` for why a row sits where it does, rather than a roadmap version file. Reasoning spanning several rows has no home, so it reaches a later session only through whoever remembers it.

`claude/skills/draft-doc/references/requirements.md` states in its Lifecycle section that later scope arrives as a new section and nothing sequences either list into versions.

### Asserting a routing decision

A router is reviewable only through what it says. A route ending in a handoff or a report leaves a review reading a body that claims a route, with no way to tell whether it fires. The `reply` expectation closes the gap by reading `result` off the envelope `max_turns` already reads, so scoring costs nothing beyond the run.

- Pin the name of the skill or command the route hands to, as `claude/target-setup/fresh` does
- Pair every pin with a `manual` entry, because a reply naming a skill in a sentence declining to route still passes a substring check
- Arms whose skills may execute nothing also assert the tree, meaning the root layout is still at the root and nothing appeared under `.claude/`

Where a handoff may legitimately continue into the skill it names, as a fresh target's does into `target-setup`, no tree assertion is declared. None separates the router doing the work from the router routing to something that does. `canon/context/sandbox/coverage/arms.md` catalogs the arms.
