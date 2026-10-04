---
title: Poll
description: How the orchestrator poll classifies a pull request, the STALE and OVERLAP base-movement readings, the baseline fields each rides in, and the fixture harness its tests build
---

# Poll

The trigger that runs `role-orchestrator/scripts/poll.ts`, where its baseline lives, and the handback its reports feed sit in `review.md`.

## How the poll classifies

`RESPONSE` is two tests rather than one count. The count asks whether a reply is new to the script, the stamp asks whether it is newer than the last pass, and a reply failing the second is one that pass already answered. A worker answers a finding and the reviewing session closes out seconds later, which is the ordinary handback rather than a race, so the count alone would report the answered thread on the next run and route a re-review that stops at the guard `review-pr` states.

The review family reaches the script through `canon pr review-state` rather than a filter of its own, one call answering the covered commit, the heading, the age, and the pass instant as four fields. That verb is the only parser of the read-time marker `review-pr` writes into every body it posts, which keeps the script from carrying a second copy of that format. The branch is taken on the record's `source` field rather than on the exit, since a refusal record carries `reason` and no `source`, and an empty result falls through to a fallback over the payload that reads the submission stamps alone. `replyState` still returns the newest reply stamp beside the count, so that test pays for no second filter either.

The age and the pass instant split rather than sharing a stamp. `age` and `STALLED` read `submittedAt`, which measures how long a posted comment has waited on a human, and `passAt` reads `readAt`, falling back to `submittedAt`, which bounds what that pass had read. Both stamps live on the row a run builds and never enter the baseline. That keeps a baseline an older version wrote readable, since the line format is unchanged, and a carried line keeps its baseline fields whole and classifies nothing.

`UNMATCHED` counts the comments this run carries under a heading outside the six the comment filters know. The count, unlike the two stamps, rides in the baseline, because the next run has to know whether a heading already reported is still the newest one.

A line read from an older baseline may lack a field, so the comparison reads a missing count as zero rather than leaning on an equality test the way `RESPONSE` does. The baseline is read as the first ten space-separated fields, so a short line still parses. `src/claude/orchestrate-poll.test.ts` and `src/claude/orchestrate-watch.test.ts` run the two scripts' behavior.

The UI family is one token, `none` or `<open|closed>-<head|behind>-<short-sha>`, read off `.reviews` by `uiState` and compared against the head as a prefix, since the `review-ui` marker may carry a short sha. It sits ahead of the unmatched heading on the snapshot line, because that heading carries spaces and has to stay last, and it rides in the baseline as the eighth field so the next run can report a transition. Carrying the covered sha in the token is what makes a second UI pass at a new head read as a change even when its heading repeats. A carried pull request never reaches that read, since `main` writes its baseline line back unchanged beyond the heading, so no `UI-` state fires on it and the baseline keeps the previous token.

### Base movement

`STALE` and `OVERLAP` read the base rather than the thread. A pull request's written set comes from its own diff against `git merge-base` with the base, with `--no-renames` so both sides of a rename count. `STALE` fires when the net diff from that fork point to the base touches the set, and an unreadable set reads `unknown`, never current.

It fires again on a push that leaves the branch behind, and `CONFLICT` does the same on a push that leaves it conflicting. A conflicted pull request reports `CONFLICT` alone, so one handback goes out. The reading rides in the baseline as the ninth field, and `--check <number>` reads it back with `merges` as one of `CONFLICT`, `STALE`, `CLEAR`, or `UNKNOWN`. The draft lift reads that rather than a line printed several runs earlier, which a compaction or a late close-out would otherwise leave to the session's memory.

`OVERLAP` merges two heads with `git merge-tree --name-only` and names the conflicted files, tried only on pairs sharing a written path, since the pairwise cost grows with the square of open pull requests. Each pair reports once, carried as a comma list of partners in the tenth field and read off the lower-numbered side, and a partner the run could not read keeps its place. Both readings stay local, a `git` call over refs the poll already fetched through `pull/<n>/head`. The baseline formatter trims trailing empty fields, so a line an older version wrote round-trips unchanged.

## The poll's tests

`src/claude/orchestrate-poll.test.ts` covers the classifier, which puts a shipped skill script under test. The harness builds a throwaway repository under `mktemp` and puts a stub `gh` first on `PATH`, answering the REST list, reviews, issue-comments, pull, and repository reads out of fixture files a case rewrites between runs. The stub refuses `pr`, `repo view`, and `graphql`. Either of the reviews and comments reads failing carries the pull request forward.

A stub `canon` sits beside it answering `pr review-state` alone, which keeps the review scope a value a case sets rather than one the machine's installed binary decides, and refusing everything else, which is the answer `pr head` gives against a fixture with no remote. Writing the scope record from the same reviews lets a case override it to a marker naming an earlier commit, and disabling the stub turns that case back into the stale `SEEN` while the rest stay green.

Two calls over one baseline replay a thread, since the classifier reaches its elif chain only on the second sighting of a pull request. A fake head sha keeps `git cat-file` failing, so `merges` reports `unknown` and `git merge-tree` never runs against a base the fixture has no remote for.

The `base movement` cases need real commits on both sides, so they add a bare `origin` carrying `main` and publish each head at `refs/pull/<n>/head`, where the poll's own fetch finds it. There `merges` reads `clean` or `conflict` for real, and the stub's open list reads `open.txt` when a case writes one, which is how a pair reaches the overlap read.
