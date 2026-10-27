---
title: Pull request clip
description: Pull request mode of ui-film, run for pr-evidence with no operator present, covering the beat choice from the checklist, the length cap, the still check that stands in for approval, the reel flag, and the push to the frames branch
---

# Pull request clip

Read at the top of `ui-film` when the caller names pull request mode. `pr-evidence` is the only caller, passing the pull request number, the `url` its `canon pr local` read returned, and the checklist text.

This mode films a short reel of what the checklist asks a reviewer to try, hosts it on `canon/frames`, and hands back the link or the reason it skipped.

## Contents

- [What changes from an ordinary run](#what-changes-from-an-ordinary-run)
- [Choose the beats](#choose-the-beats)
- [Film the reel](#film-the-reel)
- [Check each still](#check-each-still)
- [Push the reel](#push-the-reel)
- [What goes back to the caller](#what-goes-back-to-the-caller)

## What changes from an ordinary run

The mode holds only while the caller names it. An ordinary run that finds a pull request in its context still stops at Step 2 for approval.

- Skip Step 1's throwaway copy. Film the address the caller passed, joined to the config's `access` value, and start no server.
- Skip Step 2's approval. The beats come from a checklist a reviewer already reads, and the still check below is the guard against posting a wrong take.
- Skip Step 5's handoff and its output block, since the reel is the product and HyperFrames composes nothing here
- Write inside `.canon/tmp/ui-film/pr-<number>/` at the current worktree's root in place of the video workspace, since a reel is thrown away once posted
- Ask nothing at any step. Every stop below is a skip with a reason, since the ship chain runs this with nobody to answer.

## Choose the beats

Film where motion is the claim. Filter the boxes first, then spend the three beats so each feature area shows its change once before any area shows two.

### Filter the boxes

A box is filmable when it asks the reviewer to click, fill, or scroll something and its result is a visible change.

- Skip a box ending in `(taste)`, since no driver judges it
- Skip a box that asks only to look at a state the page opens on, since a screenshot already shows it
- Skip a negative box, one asserting that something does not happen, such as "no drop line draws", since footage of nothing shows nothing

Read the box's text for the negative. A box asserting an unchanged result, such as "the board goes to all projects as before", is not negative, since the action still produces a visible change. Rank it behind a box in the same group that names new behavior.

### Order the beats

A group is the bold feature-area label above at most five boxes, as `ui-checklist` defines it.

1. Take one beat per group in checklist order, from the highest-ranked filmable box of each group, up to three beats.
2. When beats remain after every group has one, take a second pass in checklist order over the boxes left, highest-ranked first within each group, up to three beats in all.

A checklist with one group gives up to three beats from it. A checklist with four groups gives three beats, one from each of the first three.

### Plan the beats

Write one plan entry for each beat chosen, then skip when none was.

- Name each beat after its box's text, cut to the action
- Write the plan per `${CLAUDE_SKILL_DIR}/references/take-craft.md`, finding each target on the served page rather than guessing it
- With no interactive box, skip as `no-interactive-box` and film nothing
- With interactive boxes that the filter removed, whether negative, static, or marked `(taste)`, skip as `no-visible-change` and film nothing

The negative test is a judgment over the box's text. A misread box costs a weaker reel and never a wrong pass, since the still check below guards the footage and the UI reviewer drives every box regardless.

Keep the whole reel at or under 12 seconds. Each beat opens and closes on a 0.6 s hold, so give each action's `wait` only what its result needs to settle.

## Film the reel

```bash
canon take <url> .canon/tmp/ui-film/pr-<number>/plan.json --out .canon/tmp/ui-film/pr-<number>/takes --reel .canon/tmp/ui-film/pr-<number>/reel.webp --json
```

Branch on the record's `reason`, never on the exit code.

| Record          | Route                                                              |
| --------------- | ------------------------------------------------------------------ |
| No `reason`     | Sum the beats' `seconds` and continue to the stills                |
| `reel-failed`   | Skip as `reel-failed` with the record's `message`                  |
| Any other value | Skip under that `reason`, such as `target-missing` with its `beat` |

When the beats sum past 12 seconds, drop the last beat from the plan and film once more. A second run past the cap skips as `over-cap`.

## Check each still

Open each beat's `still.jpg`, the closing frame the record names in its `still` field, and confirm it shows the state the beat's box describes. This check replaces the operator's approval, so it runs on every reel.

- A still showing the wrong state skips the reel as `wrong-state`, naming the beat and what the still shows
- A record whose beats carry no `still` field comes from a `canon` predating the still, so skip as `no-still` rather than posting a reel nothing checked
- Read `fallback` on each beat the way an ordinary run does. A beat filmed by screencast still joins the reel, since the reel shrinks every beat to one width.

## Push the reel

Stamp the pass in compact UTC and push the file:

```bash
canon pr frames <number> --reel .canon/tmp/ui-film/pr-<number>/reel.webp --pass "$(date -u +%Y%m%dT%H%M%SZ)" --json
```

- `ok`: hold the record's `link`
- `reel-too-large`: skip as `reel-too-large`, since GitHub would not render it
- Any other `reason`: skip under it with the record's `message`

## What goes back to the caller

Hand `pr-evidence` one of two things and print nothing of your own:

- The `link` from the push, which it passes to `canon pr evidence --reel`
- A skip, as the reason and a one-line message, which its report names
