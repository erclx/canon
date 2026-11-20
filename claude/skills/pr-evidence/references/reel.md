---
title: Reel
description: The reel pr-evidence films for an evidence comment with no operator present, covering the beat choice from the checklist, the length cap, the still check that stands in for approval, the reel flag, and the push to the frames branch
---

# Reel

Read by the reel step of `evidence.md`, passing the pull request number, the `url` or reason its `canon pr local` read returned, the checklist text, and the `--check` record.

This file films a short reel of what the checklist asks a reviewer to try, hosts it on `canon/frames`, and hands back the link or the reason it skipped. The filming rules are `ui-film`'s, in `${CLAUDE_SKILL_DIR}/../ui-film/references/take-craft.md`, and so is the config's `access` value, in `${CLAUDE_SKILL_DIR}/../ui-film/references/config.md`.

## Contents

- [How the reel runs](#how-the-reel-runs)
- [With no server to film](#with-no-server-to-film)
- [Choose the beats](#choose-the-beats)
- [Film the reel](#film-the-reel)
- [Check each still](#check-each-still)
- [Push the reel](#push-the-reel)
- [What goes back to the reel step](#what-goes-back-to-the-reel-step)

## How the reel runs

No operator is present, so the run is unattended end to end.

- Film the address the caller passed, joined to the config's `access` value, and start no server
- Approve nothing. The beats come from a checklist a reviewer already reads, and the still check below is the guard against posting a wrong take.
- Compose nothing, since the reel is the product
- Write inside `.canon/tmp/pr/reel/<number>/` at the current worktree's root, since a reel is thrown away once posted
- Ask nothing at any step. Every stop below is a skip with a reason, since the ship chain runs this with nobody to answer.

## With no server to film

A reel the comment already carries goes forward under the older head it names. With no reason beside it, the lift's `reel-unsettled` reads as unexplained, so a local reason other than `ok` films nothing and ends here.

- When the record carries a `reel` whose head the caller found trailing the tip, skip as `no-server: <local reason>`, naming the reason the local read returned
- When the record carries no reel, skip silently, since nothing trails
- The lift reads `no-server` as a skip no waiver settles, since the builder clears it by starting the server and pushing again

## Choose the beats

Film where motion is the claim. Filter the boxes first, then spend the three beats so each feature area shows its change once before any area shows two.

### Filter the boxes

A box is filmable when it asks the reviewer to click, fill, or scroll something and its result is a visible change.

- Skip a box whose trailing markers hold `(taste)`, in any order, since no driver judges it
- Skip a box that asks only to look at a state the page opens on, since a screenshot already shows it
- Keep a box about a loading or error state, since a beat holds or fails the request behind it per the take-craft reference, and the state shows nowhere else
- Skip a negative box, one asserting that something does not happen, such as "no drop line draws", since footage of nothing shows nothing

Read the box's text for the negative. A box asserting an unchanged result, such as "the board goes to all projects as before", is not negative, since the action still produces a visible change. Rank it behind a box in the same group that names new behavior.

### Order the beats

A group is the bold feature-area label above at most five boxes, as `ui-checklist` defines it.

1. Take one beat per group in checklist order, from the highest-ranked filmable box of each group, up to three beats.
2. When beats remain after every group has one, take a second pass in checklist order over the boxes left, highest-ranked first within each group, up to three beats in all.

A checklist with one group gives up to three beats from it. A checklist with four groups gives three beats, one from each of the first three.

### Hold the coverage

A reviewer watching three beats cannot tell whether the reel skipped a group or the group had nothing to film. Once the beats are ordered, hold two lists of group labels, in checklist order:

- Filmed: each group with at least one beat
- Left out: each other group, whether the filter emptied it or the cap of three ran out first

Write the two as one line, `filmed: <labels> · left out: <labels>`, joining labels with a comma and writing `none` for an empty list. A checklist with one group and three beats reads `filmed: Board · left out: none`, and one with four groups names the fourth as left out.

Recompute both lists when a refusal below drops a beat, so the line describes the reel that was pushed. A checklist with no bold group labels has no groups to name, so hold no coverage.

### Plan the beats

Write one plan entry for each beat chosen, then skip when none was.

- Name each beat after its box's text, cut to the action
- Write the plan per `${CLAUDE_SKILL_DIR}/../ui-film/references/take-craft.md`, finding each target on the served page rather than guessing it
- With no interactive box, skip as `no-interactive-box` and film nothing
- With interactive boxes that the filter removed, whether negative, static, or marked `(taste)`, skip as `no-visible-change` and film nothing
- Film a box about a scrollbar with `"scrollbars": true` on its beat per the framing rule in `take-craft.md`, rather than skipping it as `no-capture`

The negative test is a judgment over the box's text. A misread box costs a weaker reel and never a wrong pass, since the still check below guards the footage and the UI reviewer drives every box regardless.

Keep the whole reel at or under 12 seconds, which the take below enforces. Each beat opens and closes on a 0.6 s hold, so give each action's `wait` only what its result needs to settle.

## Film the reel

```bash
canon take <url> .canon/tmp/pr/reel/<number>/plan.json --out .canon/tmp/pr/reel/<number>/takes --reel .canon/tmp/pr/reel/<number>/reel.webp --max-seconds 12 --json
```

Branch on the record's `reason`, never on the exit code.

| Record              | Route                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| No `reason`         | Continue to the stills                                                                                                  |
| `reel-failed`       | Skip as `reel-failed` with the record's `message`                                                                       |
| `target-offscreen`  | Add a setup step per the note below the table, then film once more. Skip as `target-offscreen` on a second refusal      |
| `target-covered`    | Clear the cover per the note below the table, then film once more. Skip as `target-covered` on a second refusal         |
| `over-cap`          | Drop `beat` and each beat after it, then film once more. Skip as `over-cap` if `beat` is first or it refuses again      |
| `target-missing`    | Fix the plan off the record's `still` and `beat`, then film once more. A second refusal is owed, per the section below  |
| `target-ambiguous`  | Narrow the target off the record's `still` to one element, then film once more. Skip as `target-ambiguous` on a second  |
| `clip-mismatch`     | Skip as `clip-mismatch` with the record's `beat` and `message`, never as `wrong-state`, since the clip came out cropped |
| `network-unmatched` | Fix the beat's pattern off the record's `message`, then film once more. Skip as `network-unmatched` on a second refusal |
| Any other value     | Skip under that `reason`, naming its `beat` when the record carries one                                                 |

The setup step for `target-offscreen` brings the target into the window. It is a scroll over an element already inside the window, such as a fixed header, with `dy` covering the distance, or a click on a link to the target.

The fix for `target-covered` depends on the cover the record's `message` names. A banner or a dialog takes a setup step that closes it. A layer built to take every press, such as a canvas board's, takes `"through": true` on the step instead.

### A skip for a state the fixture lacks

A skip whose cause is a state the drive fixture lacks, such as `target-missing` on a control only that state renders, is work the building session owes. So is a `target-missing` that survives the retry above, since the still showed a page the plan could not reach.

- Film a beat from a box carrying `(needs fixture)` only if the state answers, and otherwise skip it as owed
- Report the owed skip on the evidence comment's `--reel-skip` line and in the closing report. Name the state, selector, or setup step the beat needed, and the selector a `target-missing` beat tried.
- Never report it as a plain skip, since the next pull request meets the same fixture and skips again
- Name the project's seed as where the state goes when `canon/config/preview.json` declares a `seed` command, since a drive-only state laid there leaves the committed fixture alone
- Read `canon pr drive-copy --help` for what the seed runs and when, rather than restating it on the comment

## Check each still

Open each beat's `still.jpg`, the closing frame the record names in its `still` field, and confirm it shows the state the beat's box describes. This check replaces the operator's approval, so it runs on every reel.

- A still showing the wrong state skips the reel as `wrong-state`, naming the beat and what the still shows
- A record whose beats carry no `still` field comes from a `canon` predating the still, so skip as `no-still` rather than posting a reel nothing checked
- Read `fallback` on each beat. A beat filmed by screencast still joins the reel, since the reel shrinks every beat to one width.

## Push the reel

Stamp the pass in compact UTC and push the file:

```bash
canon pr frames <number> --reel .canon/tmp/pr/reel/<number>/reel.webp --pass "$(date -u +%Y%m%dT%H%M%SZ)" --json
```

- `ok`: hold the record's `link`
- `reel-too-large`: skip as `reel-too-large`, since GitHub would not render it
- Any other `reason`: skip under it with the record's `message`

## What goes back to the reel step

Hand the reel step one of two things and print nothing of your own:

- The `link` from the push, which the evidence step passes to `canon pr evidence --reel`, with the coverage line held above, which it passes to `--reel-covers`
- A skip, as the reason and a one-line message, which the closing report names. A skip carries no coverage, since nothing was filmed.

Put only a reason this procedure emits on `--reel-skip`, never one written by hand. `canon pr lift` reads the reason code and settles a drivable checklist only on the few codes no builder can change, which `canon pr lift --help` lists. Any other code holds the lift until a reel lands or a review waives it.
