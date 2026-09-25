---
title: Overview
description: What the review paths cover, why no version-sequencing surface exists, how a routing decision is asserted, and the origin split autoship applies before severity
---

# Overview

## Overview

How a change is reviewed once it exists: the pull request review `review-pr` posts and re-posts, the headings a poll routes on, the lenses a pass reads the description through, and the worker's half of the channel that answers a review. Review of a local branch before it opens a pull request is `review-branch`, whose diff selection sits in `canon/context/claude-plugin/skill-baseline.md`.

## Layout

- `claude/skills/review-pr/` owns the pull request review and the heading set every other surface cites
- `claude/skills/review-address/` owns the worker's return leg, including the rebase stage
- `claude/skills/role-orchestrator/scripts/` owns `poll.sh` and `watch.sh`, which route on the headings
- `src/pr/` owns the `canon pr` verbs a pass reads the head, the marker, and the key changes through

Each file covers one part of the review loop:

- `canon/context/claude-plugin/skill-review/two-pass.md`: the first pass and the close-out, the name a body file takes, where the unchanged-head stop sits, and the commit a pass records
- `canon/context/claude-plugin/skill-review/headings.md`: the heading contract, the full set the poll routes on, and the one threshold under the heading and the dispatch
- `canon/context/claude-plugin/skill-review/lenses.md`: the lenses that read the pull request body rather than the diff
- `canon/context/claude-plugin/skill-review/worker.md`: the rebase stage, the worker role, the channel split, and the relay

## No version-sequencing surface

No version-sequencing surface exists. `role-orchestrator` and `review-pr` each read `.canon/tasks/priority.md`'s `Waiting on` cell for why a row sits where it does, one line per row, rather than a roadmap version file, so reasoning spanning several rows has no dedicated home and reaches a later session only through whoever remembers it.

`standards/requirements.md`'s Lifecycle section states that later scope arrives as a new section and that nothing sequences either list into versions.

## Asserting a routing decision

A router is reviewable only through what it says. Almost every `canon-operator` route ends in a handoff or a report rather than a file, so a review reads a body claiming a route and cannot tell on its own whether the route fires.

The `reply` expectation closes it. It reads `result` off the envelope `max_turns` already reads, so scoring a route costs nothing beyond the run, and the token worth pinning is the name of the skill or command the route hands to. `claude/target-setup/fresh` is one arm using it this way.

Pinning phrasing is the cost, and it is why every route pin is paired. A reply naming a skill in a sentence declining to route still passes a substring check, so each arm carries a `manual` entry stating the negative a substring cannot express, and the arms whose skills may execute nothing assert the tree as well: the root layout is still at the root and nothing appeared under `.claude/`.

Where a handoff may legitimately continue into the skill it names, as a fresh target's does into `target-setup`, no tree assertion is declared at all, since none separates the router doing the work from the router routing to something that does it. The arms themselves are catalogued in `canon/context/sandbox/coverage/arms.md`.

## The origin split in autoship

`auto-ship` Step 7 splits findings by origin before it reads severity. A critical or should-fix finding the branch inherited stops the chain, and one this run caused is repaired in place at any severity, bounded at a single pass the way Step 3 bounds verify. Severity alone is not enough to decide this, since a self-inflicted finding at any severity is worth fixing on the spot rather than reporting as a stop that hands the work back to the same session that created it.

Origin is causation rather than authorship, which is the half that decides the hard cases. Staleness a run induces in a file it never opened is its own. The plan's file list is not the boundary either: it scopes what a run builds, and reading it as a review boundary is scope discipline applied to the wrong question.

An offer to fix is a stop however it is worded. Naming a finding self-inflicted in the report and closing on a menu of resolutions leaves the operator holding the work, so the step forbids presenting the repair as a choice and the receipt records the fix as landed.
