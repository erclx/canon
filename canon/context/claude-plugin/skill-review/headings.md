---
title: Headings
description: The heading contract a pull request review posts under, the full set the poll routes on, the closing comment that folds into the reply, and the one threshold governing both the heading and the dispatch
---

# Headings

## The heading contract

The heading is the half a reader sees without opening anything, so it reports state rather than pass number. `## Review` covers a pass carrying a finding at any severity and `## Review closed` covers a pass carrying none, so the state comes off the most recent comment rather than off a label on a kind of pass. A close-out does not close the pull request, which is why the rule reads the latest heading rather than promising the closed one is last.

Coupling the heading to the pass number instead reads wrong whenever a later pass reopens what an earlier one closed: `review-address` nests `## Review response` under the first close-out it answers, so a thread reads as opened, answered, still open, closed, and a pass-numbered heading cannot express that.

Sharing a prefix across that family is why the detection matches the first line for equality rather than testing a prefix. A prefix test also accepts `## Review response`, and it is safe only because `review-address` posts through `gh pr comment`, which lands in `.comments` and never in `.reviews`. An equality test costs the same and owes nothing to a sibling's choice of command.

A finding withdrawn on a reply's argument leaves that count too, so a pass withdrawing every finding it carried reads as a close-out while still owing a body the short close-out line cannot carry, since that line credits a fix nobody made. `canon/context/claude-internal/orchestration.md` holds why a reply reaches the thread at all and which class of reply stays off it.

## The full set, stated once

Five headings route through `poll.sh`: `## Review`, `## Review closed`, `## Review response`, `## Rebase`, and `## Post-review findings`. `## Post-review findings` gets the same routing `## Review response` does, since a worker with something to report after a close-out needs a heading of its own: `poll.sh` reports it as a reply and sends a fresh pass.

`## Evidence`, written by `canon pr evidence`, is a sixth known heading routed nowhere. It answers no comment, so counting it as a reply would send the poll back for a re-review nothing asked for, and the poll excludes it from the unmatched filter on its own instead.

Which headings exist, which family each belongs to, and who posts each is stated once in `review-pr`, beside the threshold that skill already states once, so `review-address` and the poll cite it rather than carry their own copy.

A comment posted under a heading outside the six is reported as unmatched rather than passed over. Silence and a match read alike otherwise, so the poll surfaces an invented heading as a state a person reads rather than absorbing it silently.

### The closing comment folds into the reply

`review-address` Step 7 appends its CI confirmation to the `## Review response` reply and edits it in place, rather than posting a second comment carrying no heading. A heading-free comment passes over the poll the way ordinary chatter does: `JQ_UNMATCHED_STATE` opens with `select(startswith("## "))`, so only a comment whose first line already carries a heading prefix reaches the known-set test at all.

The confirmation states nothing the reply posted moments earlier does not already carry, so a second comment would reach no reader on either side of the channel.

## One threshold under the heading and the dispatch

One threshold governs both the heading and the dispatch: a pass carrying anything, at any severity, posts the open heading and sends the session holding the branch, and the closed heading is reserved for a pass carrying nothing at all.

A heading gated at should-fix and a dispatch gated at any finding, or the reverse, disagree on a minors-only pass: one rule reads it as open with nobody told to act, or reads it as closed while real work is owed. Grading every minor as visibility-only does not hold either, since some minors are defects a worker goes on to fix, so the grade cannot decide on its own who gets sent. The ladder names the lowest grade and lets the single threshold decide the dispatch, rather than the grade carrying a claim about who acts.

The cost is that a reader can no longer take the merge decision from the heading alone, and reads it off the counts on the summary line instead. What it buys is the invariant the poll's stalled state already assumes.

`review-pr` states the rule once, and every other surface cites that skill by name rather than restating it, since the surfaces ship separately and none of them can import anything. A citation buys one edit for the next move rather than one per surface, but it buys no check: `poll.sh` and the `pr-review` sandbox scenario both pin heading strings the skill owns, and nothing compares either against the body that states the rule, so a skill edit missing one leaves an arm scoring green against a rule nothing follows. Building that check was declined rather than deferred, since comparing a script's literals against prose is a parser over prose, a larger question than the threshold it would guard.

A minor the dispatched worker declines goes to the `## Findings` section of the task the branch closes, which the queue-refill sweep already names as the destination for a finding that changes another task. That routing does not follow the threshold, since a declined minor needs a surface surviving the merge whatever heading the pass carried.

Whether a finding is new in the diff or pre-existing and out of it is a real difference behind the two handlings, and it stays off the thread. It is a second axis on a ladder already graded imprecisely, and the single threshold closes the gap without needing it.

### The stalled state

`poll.sh` carries the detection, because a rule firing only when a session reads it produces the inconsistency a split threshold has. A jq filter takes the last family review's first line rather than its commit, and a `STALLED` state names a pull request whose open pass covers the head with nothing following it.

Reporting a standing condition rather than a transition would fire on every later run, so the classification writes a marker into the baseline field it derives and reports once per entry.

The heading alone cannot decide staleness, which the marker hides rather than fixes: one threshold under the heading and the dispatch means an open pass is a dispatch owed and made, so the healthy thread is a worker still working, and a signal firing on that path is one an operator learns to skip.

The same filter emits the pass's age beside its heading, computed in jq because `date -d` is GNU-only, and the state adds a floor of two hours, several times a review-to-follow-up cycle and well short of a thread left overnight. A project whose workers run longer raises the constant. A review carrying no timestamp reads as age zero and classifies nothing, matching the answer a pull request the run could not read already gets.

Keying on elapsed time rather than on two consecutive quiet polls also drops history the state would otherwise need. A baseline written before the field exists reads as not yet reported, so the first run after an upgrade names a thread already past the floor instead of waiting a poll to confirm what it can already see. The prose half still cannot be dropped, since the script reports and never instructs, and the state catches only a thread already in the wrong shape.

Because one threshold governs both halves, the state reaches every stalled dispatch, since a pass carrying anything posts the open heading this reads: a stalled minor reports on the same terms as a stalled blocking finding. The state stays a heading test, so it pins nothing on the summary line's counts, a separate string `review-pr` owns.
