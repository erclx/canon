---
title: Poll
description: How the orchestrator poll classifies a pull request, the STALE and OVERLAP base-movement readings, the baseline fields each rides in, and the fixture harness its tests build
---

# Poll

The trigger that runs `role-orchestrator/scripts/poll.ts`, where its baseline lives, and the handback its reports feed sit in `review.md`.

## Decisions

### How RESPONSE classifies

`RESPONSE` is two tests rather than one count. The count asks whether a reply is new to the script, and the stamp asks whether it is newer than the last pass.

A worker answers a finding and the reviewing session closes out seconds later, the ordinary handback rather than a race. The count alone would report the answered thread on the next run and route a re-review that stops at the `review-pr` guard.

### The review family

The family reaches the script through `canon pr review-state`, one call answering the covered commit, the heading, the age, and the pass instant. That verb is the only parser of the read-time marker `review-pr` writes into every body, so the script carries no second copy of the format.

- The branch is taken on the record's `source` field, since a refusal record carries `reason` and no `source`
- An empty result falls through to a fallback over the payload that reads the submission stamps alone
- `replyState` still returns the newest reply stamp beside the count, so that test pays for no second filter

### Age and pass instant split

The two do not share a stamp. `age` and `STALLED` read `submittedAt`, which measures how long a posted comment has waited on a human. `passAt` reads `readAt`, falling back to `submittedAt`, which bounds what that pass had read.

Both stamps live on the row a run builds and never enter the baseline. A baseline an older version wrote stays readable, since the line format is unchanged, and a carried line keeps its baseline fields whole and classifies nothing.

### Unmatched headings

`UNMATCHED` counts the comments this run carries under a heading outside the six the comment filters know. Unlike the stamps, the count rides in the baseline, because the next run must know whether a heading already reported is still the newest.

- A line from an older baseline may lack a field, so the comparison reads a missing count as zero rather than leaning on an equality test as `RESPONSE` does
- The baseline is read as the first ten space-separated fields, so a short line still parses
- `src/claude/orchestrate-poll.test.ts` and `src/claude/orchestrate-watch.test.ts` run the two scripts' behavior

### The UI token

The UI family is one token, `none` or `<open|closed>-<head|behind>-<short-sha>`, read off `.reviews` by `uiState` and compared against the head as a prefix, since the `review-ui` marker may carry a short sha.

- It sits ahead of the unmatched heading on the snapshot line, because that heading carries spaces and has to stay last
- It rides in the baseline as the eighth field, so the next run can report a transition
- Carrying the covered sha makes a second UI pass at a new head read as a change even when its heading repeats
- A carried pull request never reaches the read, since `main` writes its baseline line back unchanged beyond the heading, so no `UI-` state fires and the previous token stays

### Base movement

`STALE` and `OVERLAP` read the base rather than the thread. A pull request's written set comes from its own diff against `git merge-base` with the base, with `--no-renames` so both sides of a rename count.

`STALE` fires when the net diff from that fork point to the base touches the set. An unreadable set reads `unknown`, never current.

### STALE, CONFLICT, and the check

`STALE` fires again on a push that leaves the branch behind, and `CONFLICT` does the same on a push that leaves it conflicting. A conflicted pull request reports `CONFLICT` alone, so one handback goes out. The reading rides in the baseline as the ninth field.

`--check <number>` takes both readings again at call time, fetching the base and reading the head, and prints `CONFLICT`, `STALE`, `CLEAR`, or `UNKNOWN` without writing. The draft lift reads that, since the baseline is as old as the last run and misses a sibling that merged after it.

### OVERLAP

`OVERLAP` merges two heads with `git merge-tree --name-only` and names the conflicted files. It is tried only on pairs sharing a written path, since the pairwise cost grows with the square of open pull requests.

- Each pair reports once, carried as a comma list of partners in the tenth field and read off the lower-numbered side
- A partner the run could not read keeps its place
- Both readings stay local, a `git` call over refs the poll already fetched through `pull/<n>/head`
- The baseline formatter trims trailing empty fields, so a line an older version wrote round-trips unchanged

### The poll's tests

`src/claude/orchestrate-poll.test.ts` covers the classifier, which puts a shipped skill script under test. The harness builds a throwaway repository under `mktemp` and puts a stub `gh` first on `PATH`, answering the REST list, reviews, issue-comments, pull, and repository reads out of fixture files a case rewrites between runs.

- The stub refuses `pr`, `repo view`, and `graphql`, and either of the reviews and comments reads failing carries the pull request forward
- A fake head sha keeps `git cat-file` failing, so `merges` reports `unknown` and `git merge-tree` never runs against a base with no remote
- Two calls over one baseline replay a thread, since the classifier reaches its elif chain only on the second sighting of a pull request

### The stub canon

A stub `canon` sits beside the `gh` stub answering `pr review-state` alone and refusing everything else, which is the answer `pr head` gives against a fixture with no remote. That keeps the review scope a value a case sets rather than one the machine's installed binary decides.

Writing the scope record from the same reviews lets a case override it to a marker naming an earlier commit. Disabling the stub turns that case back into the stale `SEEN` while the rest stay green.

### The base movement cases

The `base movement` cases need real commits on both sides, so they add a bare `origin` carrying `main` and publish each head at `refs/pull/<n>/head`, where the poll's own fetch finds it.

`merges` then reads `clean` or `conflict` for real, and the stub's open list reads `open.txt` when a case writes one, which is how a pair reaches the overlap read.
