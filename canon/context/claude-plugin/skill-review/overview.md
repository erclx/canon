---
title: Overview
description: What the review paths cover, why no version-sequencing surface exists, how a routing decision is asserted
---

# Overview

## Overview

How a change is reviewed once it exists: the pull request review `review-pr` posts and re-posts, the headings a poll routes on, the lenses a pass reads the description through, and the worker's half of the channel that answers a review.

## Layout

- `claude/skills/review-pr/` owns the pull request review and the heading set every other surface cites
- `claude/skills/review-craft/` owns what a review looks for and the evidence bar, which both review procedures load
- `claude/skills/review-address/` owns the worker's return leg, including the rebase stage
- `claude/skills/role-orchestrator/scripts/` owns `poll.ts` and `watch.ts`, which route on the headings
- `src/pr/` owns the `canon pr` verbs a pass reads the head, the marker, and the key changes through

Each file covers one part of the review loop:

- `canon/context/claude-plugin/skill-review/criteria.md`: why the criteria split from the procedures, and why security and rendered output are references
- `canon/context/claude-plugin/skill-review/two-pass.md`: the first pass and the close-out, the name a body file takes, where the unchanged-head stop sits, and the commit a pass records
- `canon/context/claude-plugin/skill-review/headings.md`: the heading contract, the full set the poll routes on, and the one threshold under the heading and the dispatch
- `canon/context/claude-plugin/skill-review/lenses.md`: the lenses that read the pull request body rather than the diff
- `canon/context/claude-plugin/skill-review/worker.md`: the rebase stage, the worker role, the channel split, and the relay

## No version-sequencing surface

No version-sequencing surface exists. `role-orchestrator` and `review-pr` each read `.canon/tasks/priority.md`'s `Waiting on` cell for why a row sits where it does, one line per row, rather than a roadmap version file, so reasoning spanning several rows has no dedicated home and reaches a later session only through whoever remembers it.

`claude/skills/draft-doc/references/requirements.md`'s Lifecycle section states that later scope arrives as a new section and that nothing sequences either list into versions.

## Asserting a routing decision

A router is reviewable only through what it says. A route ending in a handoff or a report rather than a file leaves a review reading a body that claims a route and unable to tell on its own whether the route fires.

The `reply` expectation closes it. It reads `result` off the envelope `max_turns` already reads, so scoring a route costs nothing beyond the run, and the token worth pinning is the name of the skill or command the route hands to. `claude/target-setup/fresh` is one arm using it this way.

Pinning phrasing is the cost, and it is why every route pin is paired. A reply naming a skill in a sentence declining to route still passes a substring check, so each arm carries a `manual` entry stating the negative a substring cannot express, and the arms whose skills may execute nothing assert the tree as well: the root layout is still at the root and nothing appeared under `.claude/`.

Where a handoff may legitimately continue into the skill it names, as a fresh target's does into `target-setup`, no tree assertion is declared at all, since none separates the router doing the work from the router routing to something that does it. The arms themselves are catalogued in `canon/context/sandbox/coverage/arms.md`.
