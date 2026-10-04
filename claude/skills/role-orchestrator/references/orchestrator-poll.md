---
title: Orchestrator poll runbook
description: The review trigger, the condition under which it runs, and how to read what it reports
---

Run the orchestrator's review trigger. The poll reports pull request movement and the session acts on what it reports. The script reads and never writes, and the routing block below decides which report earns a review, which earns a dispatch, and which earns neither.

`${CLAUDE_SKILL_DIR}/scripts/poll.ts` is the script, run as `bun <path>`. It needs `bun` and `gh` authenticated against the remote, and it reads the base branch from `origin/HEAD` rather than assuming a name.

## When to run it

Start the poll on an open pull request and stop it when the last one merges with nothing else out. That is the whole condition and it resolves from the open list without asking the operator. A release pull request alone does not qualify, since its sweep carries no findings.

A dispatch no longer starts it. The script reads pull requests and a building worker has none, so every interval between the launch and the push is a fixed cost returning nothing, measured as five consecutive runs reporting no movement across roughly fifteen minutes while one worker built. What replaces it is the worker announcing its own pull request the moment it opens one, per the `role-worker` skill that session loads, which covers exactly the transition the poll cannot observe.

The dispatched-worker condition survives as a fallback rather than as a trigger. Start the poll against any dispatch still out after thirty minutes with no announcement, which is past the upper end of the ten to thirty minutes a row here takes. The announcement is newer than the narrowing it justifies, so a silent failure would otherwise leave a finished worker unnoticed the way one already sat idle for eighteen minutes, and the fallback keeps the cover a straight narrowing would have removed. `${CLAUDE_SKILL_DIR}/scripts/watch.ts` covers the same window at a lower cost, since it reads the roster alongside the pull request list and reports a worker that vanished as well as one that finished. `orchestrator-watch.md` carries how to run it and the stall alarm it prints.

A session holding a recurring-prompt scheduler starts the loop itself on that condition and cancels it on the same test, without waiting for the operator. Both halves belong to whoever holds the loop, since a session that can start one can stop one, and a runbook stating only the start leaves the always-on failure unaddressed on the side that causes it.

Nothing enforces this. No hook starts the poll and no check stops it, so the condition holds only while whoever holds the loop applies it. Left always-on it fires into an empty board through every gap between a dispatch and its push.

The poll is session-scoped and dies with the session that started it. Restart it after a compaction, and take the prompt from this file rather than from a transcript, since a running loop holds whatever wording it was started with and a correction here does not reach it.

The reverse direction is the one that goes unnoticed. A scheduled prompt cannot be edited, so every routing fix is a cancel and a re-create, and three made inside one session each reached the running loop and none reached this file. Edit the block here first and re-create the loop from what this file then says. Rewriting the block from memory drops what the shipped one covered, which is how a `SEEN` report once fell through to no rule at all.

## The prompt

The requirement is a recurring prompt at roughly three minutes carrying the block below. `/loop 3m <the block>` is the mechanism this repository uses and one example among the schedulers a client may hold, so a client without that command reaches the same requirement through whatever recurring prompt it can schedule. Naming one vendor's command as the only path dates a file that ships to every target holding the plugin.

The interval belongs to the schedule rather than to the script. One run is a single snapshot returning in about six seconds, so a session that reads `3m` as the script's runtime and relaunches on completion fires every few seconds and never settles, which happened once for 35 minutes.

Resolve `${CLAUDE_SKILL_DIR}/scripts/poll.ts` to an absolute path and paste that in place of `<POLL_SCRIPT>` below. The variable expands while this runbook renders and not in a standalone loop turn, so a block carrying the variable reaches the session as a literal string and the run improvises a substitute.

```plaintext
Poll GitHub for pull request movement by running `bun <POLL_SCRIPT>`, then act on what it reports.

- A release pull request, whatever state follows it: report it and stop. Its sweep carries no findings, so no pass is owed. Test this before any rule below, since a release pull request is reported OPENED like any other and would otherwise match that rule first.
- MOVED or RESPONSE on a pull request I have already reviewed: run the canon:review-pr skill on it immediately, narrow pass, or message the live reviewer that took its first pass to run it. Re-reviews read prior..head and gain nothing from waiting.
- OPENED, or a pull request with no prior review pass: take its first pass where the review dispatch runbook of the canon:role-orchestrator skill places it, running the canon:review-pr skill here or launching a reviewer. A draft counts, since every pull request here opens as one and skipping drafts skips everything.
- SEEN: report it and stop. A pass already covers that head, whether it arrived out of band or before the poll first saw the pull request, so no review follows.
- STALLED: read the last pass and report what it carried. The pass has sat open for hours with nothing following it, so a worker mid-task is already ruled out and the dispatch either never went out or the session holding it is gone. Confirm and re-send it under the dispatch rule below, whatever grades the pass carried. Do not re-run a review to correct the heading, since a pass on an unchanged head with no response behind it stops by design.
- CONFLICT: report it and stop. The branch owner rebases, not this session.
- UNMATCHED: report it and stop. A comment posted under a heading outside the known set reaches nobody automatically, so a person decides whether to answer it by hand or the set needs a ninth heading.
- UI-OPEN: dispatch the canon:review-address skill under the rule below, the same as an open code pass. A later RESPONSE re-sends the UI reviewer too.
- UI-CLOSED: report it, and lift the draft mark only once the code review is closed too.
- UI-STALE: the UI verdict trails the head. Message the live UI reviewer to drive the new head, or launch one, and lift no mark on it.
- GONE: report it, then sweep the board by invoking the canon:role-orchestrator skill and following its queue-refill sweep.
- A line starting `poll:`: report it verbatim and treat that pull request as unread this run. It is a failed query, not a state.
- Nothing changed: say exactly "No movement." and nothing else.

After any pass that posts a finding, at any severity, tell the session holding that branch to run the canon:review-address skill. Resolve the target by running `canon sessions list --branch <branch> --json` at that moment, which scopes the match to this repository, then route on how many sessions it returned. Zero: report the invocation for me and dispatch nobody. Exactly one, with the confidence field reading "confirmed": address that name directly. Any other count, any other confidence, or a command that is missing or refuses: fall back to picking from a session listing, open by naming the worktree and branch you believe the reader holds, and ask to be corrected. Two sessions can hold one branch, so read the count rather than the first row. The threshold is stated once in the canon:review-pr skill and governs the heading with it, so an open heading and an owed dispatch answer the same question and either one is enough to send.
```

## Reading the output

Every classification line names a pull request and a state. A line starting `poll:` is not a classification. It means a query failed and the script declined to guess, so that pull request keeps its last known state and is neither reported as moved nor swept as merged. Treat it as unread and let the next run classify it.

The script exits non-zero and classifies nothing when the open pull request list itself fails to load. That case would otherwise report every tracked pull request as merged, so the baseline is left untouched and the run says so.

The baseline lives at `.canon/tmp/pr/poll/baseline.txt` under the main worktree root and is per-machine. A first run against a board already in flight reports each open pull request once before it settles.

The eight headings the script knows are written by `review-pr`, `review-address`, `canon pr evidence`, and `review-ui`, and the whole set is stated once in the first. The reply family and the UI family are matched by filters in `poll.ts`, so a project posting either under different headings edits those to match. The review family is matched inside `canon pr review-state` instead, which the script and `review-pr` both read through, so a project renaming either review heading changes the verb rather than the script. Either way, a heading nothing matches reads as a pull request nobody has reviewed. The `UI-` states report the newest UI pass on its transition, and `UI-STALE` fires beside the `MOVED` of a push that left its marker behind. A first sighting reports none, so hold the mark wherever `canon pr evidence <number> --json` carries a `checklist` until a UI close names the head.

`UNMATCHED` is what a comment reaches under a heading outside the six the comment filters know, a UI heading posted as a comment included, carried the same way `RESPONSE` is: a rising count against the baseline is what is new to this script, and the message names the heading so a person can tell whether to answer it by hand or add it to the set. It fires on a tracked pull request only, since a first sighting reports `SEEN` or `OPENED` and takes whatever count already sits on the thread as its starting baseline rather than flagging history the poll never watched.

`RESPONSE` is qualified by recency as well as by count, so it means a reply the last pass has not already answered rather than one this script has not seen before. A worker answers a finding and the reviewing session posts its close-out seconds later, which is the ordinary handback rather than a race, so a count on its own reported the answered thread on the next run and the re-review it routed to stopped at its own guard. The state now fires when the newest reply is stamped later than the last pass, and on a pull request carrying no pass at all, which is a worker talking to nobody and worth the turn. A reply landing inside the same second as the pass is dropped, matching the comparison `review-pr` makes on the same two fields.

`STALLED` is the one state the script derives from a heading rather than from a commit or a count, since `review-pr` posts the open heading exactly when a dispatch is owed, per the threshold that skill states. The heading alone cannot carry it, because an open pass means a dispatch was owed and made, so the ordinary healthy thread is a worker still working. The age of that pass is the third test: the state fires when the open pass covers the head, nothing has followed it, and it is older than the `STALE_AFTER` seconds set at the top of the script. It reports once per entry and fires again after any commit or reply resets the thread. A project whose workers run longer than the default two hours raises that number.

The state reaches every stalled dispatch, since one threshold governs the heading and the dispatch alike and a pass carrying anything posts the open heading. A minors-only pass therefore reports here on the same terms as a blocking one, which widens the state from what it caught while the two were split. It stays a heading test rather than a count test, so nothing here pins the summary line, which is a second string this script does not own.

### The count behind the review dispatch

The report is also where the load count in `orchestrator-review-dispatch.md` is legible, and that count decides where a first pass runs, here or in a dispatched reviewer. That threshold trips on open pull requests awaiting a first pass, which is what `OPENED` and a pull request with no prior pass name here and what `SEEN` excludes, so read the count off these lines rather than off the open list, which counts a branch closed out and waiting on a merge the same as one nobody has read. It is a separate condition from the poll-start fallback above, which decides when this loop runs rather than where a review runs.

The count used to read low, and it erred in the direction that breaks the trigger. A review's `commit.oid` is stamped with the head at submission rather than with the commit the reviewer read, so an author pushing between the diff read and the post left the pass recorded against a commit it never saw, and `SEEN` then fired on a head still awaiting its first look at that delta.

The pass now carries its own record instead. `review-pr` writes the commit it read and the instant it read it as a marker on the last line of every body it posts, and both this script and that skill resolve the covered state through `canon pr review-state`, which is the one place the marker is parsed. A commit pushed inside a pass's compose window falls outside the marked range, so it reads as `MOVED` rather than as `SEEN`. A `SEEN` is a claim about what a session read rather than about what GitHub stamped, so it wants no second read to be believed.

Read `source` on the record before trusting a `SEEN` on a thread whose newest pass is old. `marker` is the read-time record. `fallback` is a pass posted before the mechanism shipped, or a target whose CLI predates the verb, and it carries the defect above unchanged, so a `SEEN` under it is worth one read of the pull's reviews before it is believed. `none` is a thread carrying no pass at all.

The other side of that comparison used to lag as well, which made the two errors compound rather than cancel. The pull read's `head.sha` answers from the pull request object and that object trails the branch ref by up to a minute after a push, reporting nothing about the trail, so a pass stamped ahead of the commit it read was compared against a head stamped behind the commit that exists. The head now comes from `canon pr head`, which resolves the tip through `git ls-remote` and reports which commit each source names, and the object's head stays behind it as the fallback for a target whose CLI predates the verb. Both halves of the comparison now answer about a commit somebody named rather than one GitHub stamped, which is what lets a `SEEN` be read as covered.
