---
title: Post the review to the pull request
description: Step 4 of review-pr, which names the body file, gives the body shape for a pass carrying findings, places the PR body block, carries the read-time marker, and runs the scans and the post
---

# Post to the PR

Step 4 of `review-pr`. The threshold that picks the heading and decides the dispatch sits in the skill body's opening, and this file applies it.

## Contents

- [The body file and finding links](#the-body-file-and-finding-links)
- [The body shapes](#the-body-shapes)
- [The marker, the scans, and the post](#the-marker-the-scans-and-the-post)

## The body file and finding links

Write the comment to `.canon/tmp/pr/review/body-<number>-<short-sha>.md` at the main worktree root, not the current worktree, which the rest of this step calls `<body-file>`. Resolve that root and send the write as a heredoc, both the way `session-worktree` states. The PR number stops two sessions reviewing different pull requests from overwriting each other between the write and the post, and the head commit stops a second pass overwriting the first one's body.

Derive both segments from Step 1. Never pick a suffix by hand, and never reuse a name the folder already holds.

When `<prior-oid>` from Step 2 equals `headRefOid`, the head repeats and the folder already holds `body-<number>-<short-sha>.md`. Add a third segment taking the id of the reply Step 2 resolved, giving `body-<number>-<short-sha>-r<comment-id>.md`, which is `<body-file>` on that path. That satisfies both prohibitions above rather than carving an exception into either. Step 2 already stopped the pass when that resolution came back empty, so reaching this line means the comment id is in hand.

A finding bound to a line links to it, so a reader skips the hunt:

```markdown
- **should-fix** ([line 12](<repo-url>/blob/<headRefOid>/<path>#L12)): what breaks and the fix
```

A finding that spans lines anchors to the span as `#L12-L14`, with no spaces and no en dash, and a single-line finding anchors as `#L12`. Take the line number from the file read at `<headRefOid>`, `git show <headRefOid>:<path>`, never from another checkout. The URL carries the full 40-character `<headRefOid>`, never `<short-sha>`, `HEAD`, or the branch name, so the link survives a push. A later pass restating an open finding links it again at its own `<headRefOid>` rather than copying the old bullet.

Four findings take the plain bullet with no link: a `**PR body**` entry, a finding on a file the head deleted, a finding on a line the diff removed from a file that survives, since the head holds no number for it, and a finding about a whole file with no one line. A path holding a character a URL needs encoded, such as a space or `#`, is percent-encoded in the link or keeps the plain bullet. Keep the file block header a bare backticked path, so the section-marker reading in `${CLAUDE_SKILL_DIR}/../../standards/markdown.md` does not change.

## The body shapes

The comment is a rendered-for-human GitHub surface, so load the `write-human` skill for voice and word choice and follow `${CLAUDE_SKILL_DIR}/../../standards/markdown.md` for punctuation: cut editorializing, and keep every sentence load-bearing. Match this shape on a first pass:

```markdown
## Review

X critical, Y should-fix, Z minor. Reviewed against project docs and the board.

**`path/to/file.ext`**

- **should-fix** ([line 12](<repo-url>/blob/<headRefOid>/path/to/file.ext#L12)): what breaks and the fix, in two or three sentences.
- **minor** ([lines 30-34](<repo-url>/blob/<headRefOid>/path/to/file.ext#L30-L34)): finding.

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

- **should-fix** ([line 12](<repo-url>/blob/<headRefOid>/path/to/file.ext#L12)): what breaks and the fix, in two or three sentences.

🤖 Reviewed by Claude Code

<!-- review-pr: commit=<headRefOid> read-at=<read-at> -->
```

A Testing question or a `## For the reviewer` bullet Step 3 read takes its own block after the file blocks, per `${CLAUDE_SKILL_DIR}/references/body-variants.md`.

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

## The marker, the scans, and the post

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
gh api -X POST 'repos/{owner}/{repo}/pulls/<number>/reviews' -f event=COMMENT -F body=@.canon/tmp/pr/review/body-<number>-<short-sha>.md --jq .html_url
```

The post goes through the REST reviews endpoint rather than the `gh pr` review subcommand, which runs on GraphQL and fails where a cloud session's GitHub proxy refuses it. `event=COMMENT` submits the review as a comment, the same state the old `--comment` flag produced.

A pass carrying nothing at all, only minors, a withdrawal, or only answered reviewer requests takes a close-out body rather than the shapes above, per `${CLAUDE_SKILL_DIR}/references/body-variants.md`.
