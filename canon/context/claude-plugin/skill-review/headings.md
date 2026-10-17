---
title: Headings
description: The heading contract a review posts under, the set the poll routes on, the closing comment, and the one threshold for heading and dispatch
---

# Headings

## Decisions

### The heading contract

The heading reports state rather than pass number, because it is the half a reader sees without opening anything. `## Review` covers a pass carrying a finding at any severity, and `## Review closed` covers a pass carrying none.

- State comes off the most recent comment, and a close-out does not close the pull request, so the rule reads the latest heading rather than promising the closed one is last
- A pass-numbered heading cannot express a thread that reads opened, answered, still open, closed, which happens when `review-address` nests `## Review response` under a close-out
- A finding withdrawn on a reply's argument leaves the count too, and a pass withdrawing all of them still owes a body, since the short close-out line credits a fix nobody made

`canon/context/claude-internal/orchestration/review.md` holds why a reply reaches the thread at all and which class stays off it.

### Equality over prefix

The family shares a prefix, so detection matches the first line for equality rather than testing a prefix. A prefix test also accepts `## Review response`, and that is safe only because `review-address` posts through `gh pr comment`, which lands in `.comments` and never in `.reviews`.

An equality test costs the same and owes nothing to a sibling's choice of command.

### The full set, stated once

Five headings route through `poll.ts`, being `## Review`, `## Review closed`, `## Review response`, `## Rebase`, and `## Post-review findings`. The last routes like `## Review response`, because a worker reporting after a close-out needs its own heading. `poll.ts` reports it as a reply and sends a fresh pass.

- `## Evidence`, written by `canon pr evidence`, is a sixth known heading routed nowhere, since it answers no comment and counting it as a reply would trigger a re-review nothing asked for
- `review-craft`'s rendered-output reference reads it, opening its images and testing its checklist
- A comment under any other `## ` heading is reported as unmatched, a UI heading posted as a comment included, so an invented heading surfaces as a state a person reads

`review-pr` states which headings exist, their families, and who posts each, once, beside the threshold. `review-address` and the poll cite it rather than carry a copy.

### The UI family

`## UI review` and `## UI review closed` are the seventh and eighth headings, posted by `review-ui` as a review beside the code pass. The poll reads them off `.reviews` with its own filter, not `canon pr review-state`, since a pass re-driving every box needs no read-time scoping. It reports `UI-OPEN`, `UI-CLOSED`, or `UI-STALE` on a transition.

- The head a verdict covers comes from the `<!-- review-ui: head=<sha> -->` marker on the body's last line, since the submission stamp follows the head
- The draft mark lifts only once both families are closed, the UI one at the current head
- `canon targets` still reads `## Review closed` alone and stays blind to the UI family
- `canon pr evidence --json` carries `checklist`, `preview`, and `local` only on the `ok` and `no-evidence` reasons, so `review-ui` reports any other reason rather than reading an absent checklist

### The UI body shape

The body is sectioned by what the operator owes, in the order Failed, Needs your eyes, Not driven, then folded Passed and Sweep blocks. A count line reads `F failed · E need your eyes · P passed · N not driven`, and a box takes one section by its verdict, so a failed taste box sits under Failed alone.

The earlier single table in checklist order buried a failure and two taste calls among eight passes and gave a taste box no image to decide from.

- A taste box now carries dark and light shots side by side, so `canon pr frames` takes a `--theme` and the path gains a theme segment, since `--box` is a checklist number to `canon pr tick`
- The heading, the last-line marker, and the label scan are unchanged, so the poll reads the body as before, and it never read the count line

### The closing comment folds into the reply

`review-address` Step 7 appends its CI confirmation to the `## Review response` reply and edits it in place, rather than posting a second comment with no heading. A heading-free comment passes over the poll like ordinary chatter, because `unmatchedState` in `poll.ts` opens with a `.startsWith('## ')` test.

The confirmation adds nothing the reply posted moments earlier does not carry, so a second comment would reach no reader on either side of the channel.

### One threshold under the heading and the dispatch

A pass carrying anything, at any severity, posts the open heading and sends the session holding the branch. The closed heading is reserved for a pass carrying nothing.

- Two thresholds disagree on a minors-only pass, reading it as open with nobody told to act or as closed while work is owed
- Grading every minor as visibility-only fails too, since some minors are defects a worker goes on to fix, so the grade cannot decide who gets sent
- A reader reads the merge decision off the summary line's counts rather than the heading alone, and in return the poll's stalled state can assume an open pass means a dispatch owed and made

### Citing the threshold

`review-pr` states the rule once and every other surface cites the skill by name, since the surfaces ship separately and none can import anything. A citation buys one edit per move rather than one per surface, and buys no check.

`poll.ts` and the `pr-review` sandbox scenario both pin heading strings the skill owns, and nothing compares them against the body. A skill edit missing one leaves an arm scoring green against a rule nothing follows.

- The check was declined, since comparing a script's literals against prose is a parser over prose, a larger question than the threshold it would guard

### Declined minors and finding age

A minor the dispatched worker declines goes to the `## Findings` section of the task the branch closes, where the queue-refill sweep already routes a finding that changes another task. That ignores the threshold, because a declined minor needs a surface that survives the merge.

Whether a finding is new in the diff or pre-existing stays off the thread. It is a second axis on an imprecise ladder, and the single threshold closes the gap without it.

### The stalled state

`poll.ts` carries the detection, because a rule that fires only when a session reads it breeds the inconsistency a split threshold has. `STALLED` names a pull request whose open pass covers the head with nothing following it.

The heading alone cannot decide this. A healthy open thread is a worker still working, and a signal firing there is one an operator learns to skip.

- The filter takes the last family review's first line rather than its commit and emits the pass's age, computed in the script to stay off GNU-only `date -d`
- The floor is two hours, several times a review-to-follow-up cycle and well short of a thread left overnight, and a project whose workers run longer raises the constant
- A review with no timestamp reads as age zero and classifies nothing, matching a pull request the run could not read

### Reporting the state once

A standing condition reported on every run is noise, so the classification writes a marker into the baseline field it derives and reports once per entry.

Keying on elapsed time rather than two consecutive quiet polls drops history the state would otherwise need. A baseline written before the field exists reads as not yet reported, so the first run after an upgrade names a thread already past the floor.

- The prose half stays, since the script reports and never instructs
- One threshold governs both halves, so a stalled minor reports like a stalled blocking finding
- The state tests the heading only and pins nothing on the summary line's counts, a string `review-pr` owns
