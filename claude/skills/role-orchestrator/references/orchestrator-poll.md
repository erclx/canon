---
title: Orchestrator poll runbook
description: The review trigger, the condition under which it runs, and how to read what it reports
---

Run the orchestrator's review trigger. The poll reports pull request movement and the session acts on what it reports. The script reads and never writes, and the routing block below decides which report earns a review, which earns a dispatch, and which earns neither.

`${CLAUDE_SKILL_DIR}/scripts/poll.ts` is the script, run as `bun <path>`. It needs `bun` and `gh` authenticated against the remote, and it reads the base branch from `origin/HEAD` rather than assuming a name.

## When to run it

Start the poll on an open pull request and stop it when the last one merges with nothing else out. That is the whole condition, and it resolves from the open list without asking the operator. A release pull request alone does not qualify, since its sweep carries no findings.

### A dispatch no longer starts it

The script reads pull requests and a building worker has none, so every interval between the launch and the push returns nothing. That cost measured as five consecutive runs reporting no movement across roughly fifteen minutes while one worker built.

- The worker announces its own pull request the moment it opens one, per `role-worker`, which covers the transition the poll cannot observe
- Start the poll against any dispatch still out after thirty minutes with no announcement, past the upper end of the ten to thirty a row takes
- That fallback keeps the cover against a silent failure, since a finished worker once sat idle for eighteen minutes unnoticed

`${CLAUDE_SKILL_DIR}/scripts/watch.ts` covers the same window at a lower cost, since it reads the roster beside the pull request list and reports a vanished worker as well as a finished one. Read `${CLAUDE_SKILL_DIR}/references/orchestrator-watch.md` before starting it, for the stall alarm and the notification each alarm line owes the operator.

### Who starts and stops it

A session holding a recurring-prompt scheduler starts the loop on that condition and cancels it on the same test, without waiting for the operator. A runbook stating only the start leaves the always-on failure unaddressed on the side that causes it.

- Nothing enforces this. No hook starts the poll and no check stops it, so the condition holds only while the loop's holder applies it.
- Left always-on, it fires into an empty board through every gap between a dispatch and its push
- The poll is session-scoped and dies with its session, so restart it after a compaction, taking the prompt from this file rather than a transcript

### Editing the prompt

A running loop holds whatever wording it was started with, and a scheduled prompt cannot be edited, so every routing fix is a cancel and a re-create. Three fixes made inside one session once reached the running loop and none reached this file.

Edit the block here first and re-create the loop from what this file then says. Rewriting the block from memory drops what the shipped one covered, which is how a `SEEN` report once fell through to no rule at all.

## The prompt

The requirement is a recurring prompt at roughly three minutes carrying the block below. `/loop 3m <the block>` is this repository's mechanism and one example among the schedulers a client may hold, so a client without it schedules whatever recurring prompt it can.

- The interval belongs to the schedule, since one run is a six-second snapshot, and relaunching on completion once fired every few seconds for 35 minutes
- Paste the absolute path of `${CLAUDE_SKILL_DIR}/scripts/poll.ts` in place of `<POLL_SCRIPT>` below
- The variable expands while this runbook renders and not in a standalone loop turn, so a block carrying it reaches the session as a literal and the run improvises

```plaintext
Poll GitHub for pull request movement by running `bun <POLL_SCRIPT>`, then act on what it reports.

- A release pull request, whatever state follows it: report it and stop. Its sweep carries no findings, so no pass is owed. Test this before any rule below, since a release pull request is reported OPENED like any other and would otherwise match that rule first.
- MOVED or RESPONSE on a pull request already reviewed: when a live local reviewer holds it, report it and stop, since the worker asks that reviewer for the re-review directly. When none does, which a cloud reviewer always leaves, launch a fresh reviewer under the review dispatch runbook of the canon:role-orchestrator skill. Never run the canon:review-pr skill here. Re-reviews read prior..head and gain nothing from waiting.
- OPENED, or a pull request with no prior review pass: launch its reviewer under the review dispatch runbook of the canon:role-orchestrator skill, and its UI reviewer beside it when the evidence record carries a checklist. Never run the first pass here. A draft counts, since every pull request here opens as one and skipping drafts skips everything.
- SEEN: report it and stop. A pass already covers that head, whether it arrived out of band or before the poll first saw the pull request, so no review follows.
- STALLED: read the last pass and report what it carried. The pass has sat open for hours with nothing following it, so a worker mid-task is already ruled out and the dispatch either never went out or the session holding it is gone. Confirm and re-send it under the dispatch rule below, whatever grades the pass carried. Do not re-run a review to correct the heading, since a pass on an unchanged head with no response behind it stops by design.
- CONFLICT or STALE: send the session holding that branch the rebase handback in the canon:role-orchestrator skill's handback runbook, resolving it the way the handback rule below does. The branch owner rebases, not this session. The poll prints one of the two for a pull request, never both, so it earns one message. The canon pr lift verb refuses on either standing itself, since the green run tested a main that no longer exists, so nothing here lifts the mark.
- OVERLAP: report the pair and the files, and settle their merge order now under the Parallelism rule of the canon:role-orchestrator skill. Dispatch nobody. The second to merge reads STALE or CONFLICT once the first lands, and the handback goes out then.
- UNMATCHED: report it and stop. A comment posted under a heading outside the known set reaches nobody automatically, so a person decides whether to answer it by hand or the set needs a ninth heading.
- UI-OPEN: a zero-driven pass goes to the live UI reviewer to drive again, or a new one. Any other: report and stop if that reviewer holds it, since it dispatches canon:review-address, else use the fallback rule below.
- UI-CLOSED: report it. When the pull request is still a draft and its code review is closed too, run `canon pr lift <number> --json` and report the reason it returns. Each reviewer runs the verb on its own close, so this run is the fallback for a lift neither reviewer's run made, and the verb reads every gate itself.
- A pull request a cloud reviewer holds, on every run whatever the script printed for it: run `canon pr review-state <number> --json`. The script reports nothing when a code review posts on an unchanged head, so this read is the only one that sees a cloud pass land. An open pass newer than the last dispatch earns the dispatch rule below. A closed pass at the head on a pull request still a draft earns `canon pr lift <number> --json`, reporting the reason it returns, since a cloud reviewer can neither message nor lift.
- UI-STALE: the UI verdict trails the head. Message the live UI reviewer to drive the new head, or launch one, and lift no mark on it.
- GONE: report it, then sweep the board by invoking the canon:role-orchestrator skill and following its queue-refill sweep.
- A line starting `poll:`: report it verbatim and treat that pull request as unread this run. It is a failed query, not a state.
- Nothing changed: say exactly "No movement." and nothing else.

After a pass that posts a finding, at any severity, and that no live local reviewer sent on, tell the session holding that branch to run the canon:review-address skill. That covers a cloud reviewer's pass, a reviewer's message reporting no live worker, and a STALLED pass, which is by definition one nobody acted on, and nothing else, since a second dispatch for one pass runs review-address twice. Resolve the target by running `canon sessions list --branch <branch> --json` at that moment, which scopes the match to this repository, then route on how many sessions it returned. Zero: launch the review-address shape in the canon:role-orchestrator skill's launch runbook, carrying the reviewer's sessionId when a local reviewer is live. Exactly one, with the confidence field reading "confirmed": address that name directly. Any other count, any other confidence, or a command that is missing or refuses: fall back to picking from a session listing, open by naming the worktree and branch you believe the reader holds, and ask to be corrected. Two sessions can hold one branch, so read the count rather than the first row. The threshold is stated once in the canon:review-pr skill and governs the heading with it, so an open heading and an owed dispatch answer the same question and either one is enough to send.
```

## Reading the output

Every classification line names a pull request and a state. A line starting `poll:` is a failed query rather than a classification, so that pull request keeps its last known state and is neither reported as moved nor swept as merged.

- The script exits non-zero and classifies nothing when the open list itself fails to load, leaving the baseline untouched, since it would report every pull request merged
- The baseline lives at `.canon/tmp/pr/poll/baseline.txt` under the main worktree root and is per-machine
- A first run against a board already in flight reports each open pull request once before it settles

### Headings the script knows

The eight headings the script knows are written by `review-pr`, `review-address`, `canon pr evidence`, and `review-ui`, and the whole set is stated once in the first. A heading nothing matches reads as a pull request nobody has reviewed.

- The reply family matches by a filter in `poll.ts`, so a project posting it under different headings edits that
- The review and UI families match inside `canon pr review-state`, which the script and `review-pr` both read, so renaming one changes the verb
- The `UI-` states report the newest UI pass on its transition, and `UI-STALE` fires beside the `MOVED` of a push that left its marker behind
- A first sighting reports no `UI-` state at no cost to the mark, since `canon pr lift` reads the UI review itself and holds the mark on a `canon pr evidence` checklist until a UI close names the head

### UNMATCHED and RESPONSE

`UNMATCHED` is a comment under a heading outside the six the comment filters know, a UI heading posted as a comment included. It fires on a rising count against the baseline, and the message names the heading so a person can answer by hand or add it to the set.

- It fires on a tracked pull request only, since a first sighting takes the thread's count as its baseline rather than flagging history
- `RESPONSE` means a reply the last pass has not answered, qualified by recency as well as count, since a close-out seconds after a worker's answer is the ordinary handback
- It fires when the newest reply is stamped later than the last pass, or on a pull request with no pass, which is a worker talking to nobody
- A reply landing in the same second as the pass is dropped, matching the comparison `review-pr` makes on the same two fields

### STALLED

`STALLED` is the one state derived from a heading rather than a commit or a count, since `review-pr` posts the open heading exactly when a dispatch is owed. An open pass alone is the ordinary healthy thread, a worker still working, so the age of the pass is the third test.

- It fires when the open pass covers the head, nothing has followed it, and it is older than the `STALE_AFTER` seconds set at the top of the script
- It reports once per entry and fires again after any commit or reply resets the thread. A project whose workers run past two hours raises the number.
- One threshold governs the heading and the dispatch, so a minors-only pass reports here on the same terms as a blocking one
- It stays a heading test, so nothing pins the summary line, a second string this script does not own

### Base movement

A pull request's run tests the merge with the base as of its last push, so once a sibling merges, that green describes a merge nobody will make. `STALE` closes that gap by hand where a ruleset requiring current branches, or a merge queue, would close it on the host.

- It fires when the base changed a file the pull request writes since the commit it branched from, and names the files
- A base moving only on files the branch does not write reads as nothing, since re-testing after every merge is a merge queue's cost without its batching
- `STALE` and `CONFLICT` report on their transition and on every push leaving the reading standing, then live only in the baseline

### Reading a standing state

Read a standing one with `--check <number>`, which fetches the base and reads the head at call time, so a sibling merging after the last run still shows. It prints `CONFLICT`, `STALE`, `CLEAR`, or `UNKNOWN` and writes nothing.

- It takes the standing `canon pr lift <number> --check --json` reads, so the lift and this check answer from one read
- It falls back to its own merge-tree read where the record carries no standing gate, as a binary older than that verb leaves
- A pull request whose written set could not be read, being a fork or a deleted head, reads `UNKNOWN`, so its lift waits on a person

### OVERLAP

`OVERLAP` names two open pull requests that conflict with each other, read by merging their heads locally. Only pairs sharing a written path are tried, which keeps a wave of ten to a handful of merges. It reports once per pair, carried in the tenth baseline field, so the merge order is settled before the second branch has to rebase.

### What a SEEN rests on

A review's `commit.oid` is stamped with the head at submission rather than the commit the reviewer read. An author pushing between the diff read and the post would leave the pass recorded against a commit it never saw, and `SEEN` would fire on an unread delta.

The pass carries its own record instead. `review-pr` writes the commit it read and the instant it read it as a marker on the last line of every body, and both this script and that skill resolve the covered state through `canon pr review-state`, the one place the marker is parsed.

- A commit pushed inside a pass's compose window falls outside the marked range, so it reads as `MOVED` rather than `SEEN`
- A `SEEN` is a claim about what a session read rather than what GitHub stamped, so it wants no second read to be believed

### The source behind a SEEN

Read `source` on the record before trusting a `SEEN` on a thread whose newest pass is old.

- `marker`: the read-time record
- `fallback`: a pass posted before the marker shipped, or a target whose CLI predates the verb, carrying the defect above, so read the reviews once before believing it
- `none`: a thread carrying no pass at all

### The head side of the comparison

The pull read's `head.sha` answers from the pull request object, which trails the branch ref by up to a minute after a push and reports nothing about the trail. A stamp ahead of the commit read, compared against a head behind the real one, made the two errors compound.

The head now comes from `canon pr head`, which resolves the tip through `git ls-remote` and reports which commit each source names. The object's head stays behind it as the fallback for a target whose CLI predates the verb, so both halves answer about a commit somebody named.
