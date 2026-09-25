---
title: Post the review to the pull request
description: Step 4 of review-pr, which names the body file, gives the body shape for each pass, places the Testing, reviewer, and PR body blocks, carries the read-time marker, and rewrites a repeated close-out in place
---

# Post to the PR

Step 4 of `review-pr`. The threshold that picks the heading and decides the dispatch sits in the skill body's opening, and this file applies it.

Write the comment to `.canon/tmp/pr/review/body-<number>-<short-sha>.md` at the main worktree root, not the current worktree, which the rest of this step calls `<body-file>`. Resolve that root and send the write as a heredoc, both the way `session-worktree` states. The PR number stops two sessions reviewing different pull requests from overwriting each other between the write and the post, and the head commit stops a second pass overwriting the first one's body.

Derive both segments from Step 1. Never pick a suffix by hand, and never reuse a name the folder already holds.

When `<prior-oid>` from Step 2 equals `headRefOid`, the head repeats and the folder already holds `body-<number>-<short-sha>.md`. Add a third segment taking the id of the reply Step 2 resolved, giving `body-<number>-<short-sha>-r<comment-id>.md`, which is `<body-file>` on that path. That satisfies both prohibitions above rather than carving an exception into either. Step 2 already stopped the pass when that resolution came back empty, so reaching this line means the comment id is in hand.

The comment is a rendered-for-human GitHub surface, so load the `write-human` skill for voice and word choice and follow `${CLAUDE_SKILL_DIR}/../../standards/markdown.md` for punctuation: cut editorializing, and keep every sentence load-bearing. Match this shape on a first pass:

```markdown
## Review

X critical, Y should-fix, Z minor. Reviewed against project docs and the board.

**`path/to/file.ext`**

- **should-fix**: what breaks and the fix, in two or three sentences.
- **minor**: finding.

**What is right**

- bounded confirmation.

🤖 Reviewed by Claude Code

<!-- review-pr: commit=<headRefOid> read-at=<read-at> -->
```

A stale ticked box goes in a `**PR body**` block, in place of a `**`path/to/file.ext`**` block and ahead of every one of those, since it precedes the code the diff carries rather than sitting inside it.

Run `canon labels scan --title "<title>" --body "<body>" --head <headRefName>` against the PR under review, since Step 1 already holds all three and this pass is the last human-shaped gate before merge. A hit lands in the same `**PR body**` block, `should-fix`, naming each finding the scan returns: a token quoted from the title or body for a phase label, a board identifier, a session link, or an unspelled word, and the broken rule's name, `structure`, a casing issue, or `length`, for a title-format hit. This reads the pull request being reviewed, distinct from the comment this pass is about to post, which the scan later in this step still covers.

A later pass carrying findings keeps that shape and changes only the summary line:

```markdown
## Review

Re-reviewed `<short-sha>`, N commits since the prior pass. X critical, Y should-fix, Z minor.

**`path/to/file.ext`**

- **should-fix**: what breaks and the fix, in two or three sentences.

🤖 Reviewed by Claude Code

<!-- review-pr: commit=<headRefOid> read-at=<read-at> -->
```

A Testing box the Step 3 check raised goes in a `**Testing**` block placed after the file blocks, one bullet per box, each quoting the box and naming what would drive it. It carries no severity and enters no count, and it is still something owed, so a pass carrying one takes `## Review` and the full body rather than either ✅ line. Say so on the summary line as `plus N testing question(s)`, since the three counts read as zero and would otherwise report the pass as silent.

```markdown
**Testing**

- `- [ ] <the box as written>` names no capability the agent lacks. `scripts/sandbox/run.sh <arm>` drives it. Was there a reason to leave it?
```

Keep it to the boxes the check raised. Restating a box whose stated requirement holds teaches the branch author to skip the block.

Every `## For the reviewer` bullet Step 3 read goes in a `**For the reviewer**` block placed after the Testing block, one bullet per request, each followed by its answer or, where the pass could not answer it, by what would settle it. It carries no severity and enters no count.

An unanswered bullet is owed the same way an unanswered Testing box is, so a pass carrying one takes `## Review` and the full body rather than either ✅ line. A bullet the pass answered is not owed, since the answer is discharged in the same comment that carries it. A pass still posting a numeric summary line, because a finding, a Testing question, or an unanswered bullet already forces one, says so there as `plus N reviewer request(s)`. The all-answered close-out below carries the block in place of that line and needs no addition to it.

```markdown
**For the reviewer**

- Confirm the 401 and 403 split reads correctly for the public API. Confirmed — `AuthService.authenticate()` returns 401 for an expired token and 403 for a missing scope, and both paths are covered under `## Testing`.
```

Keying either half of the opening's threshold on the grade was measured wrong: across 8 findings on one archived pass, 3 were posted as minor and 2 of those were defects a worker fixed rather than recorded, so a floor at should-fix loses real fixes to a grade that runs low. Splitting the two halves so the dispatch fired lower than the heading was the other candidate, and it left a thread reading closed while work was owed on it. The Testing question was first written to sit outside both, which is that same split reached from the other side, and it left the one party who could answer the question with no route to it.

The cost is that the merge decision no longer reads off the heading alone, since an open heading covers a minor as well as a critical. Take it from the counts on the summary line, which is where they already sit. No summary line reports the merge as unblocked under either heading, since a thread reading open cannot also report that nothing blocks it.

A minor the dispatched worker declines is what needs a surface that survives the merge, rather than every minor, since one that gets fixed on the branch needs no durable record. Write a declined minor into the `## Findings` section of the task the branch closes, which is where the queue-refill sweep already routes a finding that changes another task. A declined finding left on the thread alone is lost the moment the pull request merges.

Read the state off the most recent review comment rather than off the presence of a closed one. A close-out does not close the pull request, so a commit pushed after it gets its own pass, and that pass reopens the review under `## Review` when it raises a finding of any grade.

Do not append the PR number to either heading, which GitHub already renders above the comment.

Name the scope in every summary line after the first pass, since a reader cannot otherwise tell a narrow read from a full one. When the fallback in Step 2 fired, replace the commit count with `Re-reviewed the full change, the prior pass's commit is no longer on the branch`.

Budget the body. State each finding as the failure and the fix in two or three sentences, not a paragraph of reasoning.

Omit files with no findings. Do not lecture on process. The integration, contract, and consumer lenses stay, but as findings, not asides.

The `What is right` section is optional, capped at three bullets, and included only when it changes the merge decision. Drop it otherwise and let the summary line carry the approval.

Close the body with `🤖 Reviewed by Claude Code` on its own line so the review reads as an independent machine pass, not a human sign-off.

### The marker every body carries

End every body with this line, carrying `<headRefOid>` and `<read-at>` from Step 1 verbatim:

```markdown
<!-- review-pr: commit=<headRefOid> read-at=<read-at> -->
```

Every body this step writes carries it, with no exception: the full body under either heading, both ✅ close-out lines, a withdrawal body, and the `PUT` rewrite in `close-out.md`. A body missing it reads as a pre-marker pass, so the next reader falls back to the stamps and the pass loses the coverage it actually had.

Last is load-bearing rather than tidy. `canon pr review-state` reads the last non-empty line and searches nowhere else, so a marker written above the footer is a marker the next pass does not see. That position is also what lets a finding quote the format safely, including inside a fenced block, since a quotation is never the line the reader takes.

It is what the review is scoped from. GitHub stamps `commit.oid` and `submittedAt` when a review is submitted, not when it was read, so a push landing in the compose window moves both onto a commit this pass never opened and the next pass reads that commit as covered. The marker is the read-time record those two fields are not, and `canon pr review-state` is the one place it is parsed, so Step 2 here and the orchestrator poll read one answer rather than each carrying a copy of the format.

Write it as a comment rather than as prose so a reader of the thread never meets it. HTML comments render as nothing on GitHub, which is why the fact travels here rather than in a footer line a person would have to be told to ignore.

It is inert data, so the `publish.md` scan below and `canon labels scan` have nothing to fire on. Confirm that against the posted body rather than assuming it, since a phase label or a board identifier appearing inside a commit sha is not a shape either scan was written against.

Before posting, run the scan in `${CLAUDE_SKILL_DIR}/../../standards/publish.md` against the body. The hook skips `.canon/tmp/`, so this scan is the only gate ahead of the post. A finding phrased against an internal phase label is what the label half of the scan catches here. This repository reads the same text again once posted, on `phase-label-gate.yml`'s `pull_request_review` trigger, which is what closes the gap this scan leaves open for a review a person writes and posts by hand with no scripted step in front of it. That workflow now reaches every target on the `base` stack, seeded at `tooling/base/configs/.github/workflows/phase-label-gate.yml` invoking the published CLI rather than this checkout's own source tree, so a target's coverage extends past this pre-post scan to the same post-trigger re-read this repository gets.

Do not run the command below when `<prior-heading>` from Step 2 reads `## Review closed` and this pass carries nothing owed. That pass replaces the standing comment rather than adding one, so read `${CLAUDE_SKILL_DIR}/references/close-out.md` instead of posting. Posting first and reaching that section afterward leaves two close-outs both naming the new head, which is worse than the pair the guard exists against.

```bash
gh pr review <number> --comment --body-file .canon/tmp/pr/review/body-<number>-<short-sha>.md
```

A pass carrying nothing at all takes `## Review closed` and a short body, with the footer line included either way. On a first pass, post `✅ No findings. Reviewed against project docs and the board.` On a later pass, post `✅ Prior findings addressed. Re-reviewed <short-sha>, N commits since the prior pass.`

A pass carrying only minors is an ordinary finding-carrying pass, so it takes the open heading and the full shape rather than either short line, since the minors have to be readable and neither line reports them. A pass carrying only Testing questions, or only an unanswered reviewer request, takes the same route for the same reason. Keep whichever scope sentence the pass owes on the summary line:

```markdown
## Review

0 critical, 0 should-fix, Z minor. Reviewed against project docs and the board.

**`path/to/file.ext`**

- **minor**: finding, and the fix it wants.

🤖 Reviewed by Claude Code

<!-- review-pr: commit=<headRefOid> read-at=<read-at> -->
```

A pass that closed by withdrawing a finding rather than by reading its fix takes neither ✅ line, per the withdrawal rule in Step 3. Both claim a fix landed, and the second names it, so posting either over a withdrawal credits work nobody did on the one comment a reader treats as the verdict. Write the withdrawal and the fact that settled it in place of the canned line, keeping the heading and the footer.

A pass whose only content is a `## For the reviewer` block with every bullet answered, and that owes nothing else, takes the same shape: `## Review closed`, the block in place of the canned line, and the footer. The heading reports what the branch author still owes rather than what the pass did, and an answer discharged in the same comment owes nothing back.

Post a close-out even when there is nothing to report. A review left with no closing comment reads as one nobody answered.
