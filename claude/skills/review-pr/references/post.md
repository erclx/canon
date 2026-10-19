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

Write the comment to `.canon/tmp/pr/review/body-<number>-<short-sha>.md` at the main worktree root, not the current worktree, which the rest of this step calls `<body-file>`. Resolve that root and send the write as a heredoc, both the way `session-worktree` states.

- The PR number stops two sessions reviewing different pull requests from overwriting each other between the write and the post
- The head commit stops a second pass overwriting the first one's body
- Derive both segments from Step 1. Never pick a suffix by hand, and never reuse a name the folder already holds.

### A repeated head

When `<prior-oid>` from Step 2 equals `headRefOid`, the folder already holds `body-<number>-<short-sha>.md`. Add a third segment taking the id of the reply Step 2 resolved, giving `body-<number>-<short-sha>-r<comment-id>.md` as `<body-file>`.

That satisfies both prohibitions above rather than carving an exception into either. Step 2 already stopped the pass when that resolution came back empty, so reaching this line means the comment id is in hand.

### Finding links

A finding bound to a line links to it, so a reader skips the hunt:

```markdown
- **should-fix** ([line 12](<repo-url>/blob/<headRefOid>/<path>#L12)): what breaks, in one sentence
```

- A span anchors as `#L12-L14`, with no spaces and no en dash, and a single line as `#L12`
- Take the line number from the file read at `<headRefOid>`, `git show <headRefOid>:<path>`, never from another checkout
- The URL carries the full 40-character `<headRefOid>`, never `<short-sha>`, `HEAD`, or the branch name, so the link survives a push
- A later pass restating an open finding links it again at its own `<headRefOid>` rather than copying the old bullet

### Findings with no link

Four findings take the plain bullet with no link, since the head holds no line number for them.

- A `**PR body**` entry, and a finding about a whole file with no one line
- A finding on a file the head deleted, or on a line the diff removed from a file that survives
- A path holding a character a URL needs encoded, such as a space or `#`, is percent-encoded in the link or keeps the plain bullet
- Keep the file block header a bare backticked path, so the section-marker reading in `${CLAUDE_SKILL_DIR}/../markdown-craft/references/markdown.md` holds

## The body shapes

The comment is a rendered-for-human GitHub surface, so load the `write-human` skill for voice and word choice and follow `${CLAUDE_SKILL_DIR}/../markdown-craft/references/markdown.md` for punctuation. Cut editorializing, and keep every sentence load-bearing. Match this shape on a first pass:

```markdown
## Review

X critical, Y should-fix, Z minor. Reviewed against project docs and the board.

**`path/to/file.ext`**

- **should-fix** ([line 12](<repo-url>/blob/<headRefOid>/path/to/file.ext#L12)): what breaks, in one sentence.
  - one fact of evidence, with its link
  - Fix: the change
- **minor** ([lines 30-34](<repo-url>/blob/<headRefOid>/path/to/file.ext#L30-L34)): what breaks, in one sentence.
  - Fix: the change

<details>
<summary>Review focus, N checked</summary>

- the case: the test or read that covers it

</details>

🤖 Reviewed by Claude Code

<!-- review-pr: commit=<headRefOid> read-at=<read-at> -->
```

A later pass carrying findings keeps that shape and changes only the summary line:

```markdown
## Review

Re-reviewed `<short-sha>`, N commits since the prior pass. X critical, Y should-fix, Z minor.

**`path/to/file.ext`**

- **should-fix** ([line 12](<repo-url>/blob/<headRefOid>/path/to/file.ext#L12)): what breaks, in one sentence.
  - Fix: the change

🤖 Reviewed by Claude Code

<!-- review-pr: commit=<headRefOid> read-at=<read-at> -->
```

### The finding shape

A reader decides from the first line of a finding whether to open the rest, so the subject carries the failure alone.

- The subject is one sentence under 200 characters, naming what breaks rather than how the pass found it
- Each nested bullet carries one fact of evidence with its link, and the last one opens on `Fix:`
- A nested bullet stays under 200 characters too, since `canon labels scan` measures it as a bullet of its own
- A finding with nothing to add past its subject takes the `Fix:` bullet alone

A Testing question or a `## For the reviewer` bullet Step 3 read takes its own block after the file blocks, per `${CLAUDE_SKILL_DIR}/references/body-variants.md`. A request or a focus case that fails leaves `<details>` and becomes a finding.

### The PR body block

A stale ticked box goes in a `**PR body**` block, ahead of every file block, since it precedes the code the diff carries rather than sitting inside it.

Run `canon labels scan --title "<title>" --body "<body>" --head <headRefName>` against the PR under review, since Step 1 already holds all three and this pass is the last human-shaped gate before merge. A hit lands in the same block as a `should-fix`.

- Name the token quoted from the title or body for a phase label, a board identifier, or a session link
- Name the broken rule, being `structure`, a casing issue, or `length`, for a title-format hit
- A heading in `sections.outside` or `sections.missing`, or a character in `bannedCharacters`, is a hit of the same weight, naming the heading or the character
- This reads the pull request under review, distinct from the comment this pass posts, which the scan later in this step covers

### Why the threshold ignores the grade

Keying either half of the opening's threshold on the grade was measured wrong. Across 8 findings on one archived pass, 3 were posted as minor and 2 of those were defects a worker fixed, so a floor at should-fix loses real fixes to a grade that runs low.

- Firing the dispatch lower than the heading left a thread reading closed while work was owed on it
- A Testing question sitting outside both is the same split, and it left the one party who could answer it with no route
- The cost is that the merge decision reads off the summary line's counts rather than the heading, since an open heading covers a minor and a critical alike
- No summary line reports the merge as unblocked under either heading, since a thread reading open cannot also report that nothing blocks it

### Declined minors and reopening

A minor the dispatched worker declines needs a surface that survives the merge, since one fixed on the branch needs no record and one left on the thread is lost at merge. Write it into the `## Findings` section of the task the branch closes.

- Open the line with the bold source-and-date label from `${CLAUDE_SKILL_DIR}/../task-board/references/tasks.md`, where the queue-refill sweep already routes such a finding
- Read the state off the most recent review comment rather than off the presence of a closed one
- A close-out does not close the pull request, so a later commit gets its own pass, which reopens under `## Review` on a finding of any grade

### Summary line and budget

Name the scope in every summary line after the first pass, since a reader cannot otherwise tell a narrow read from a full one. When the fallback in Step 2 fired, replace the commit count with `Re-reviewed the full change, the prior pass's commit is no longer on the branch`.

- Do not append the PR number to either heading, which GitHub already renders above the comment
- State each finding in the shape above, never as a paragraph of reasoning
- Omit files with no findings and do not lecture on process. The integration, contract, and consumer lenses stay as findings, not asides.
- Leave `What is right` out unless the author asked a direct question it answers, then cap it at three bullets
- Close with `🤖 Reviewed by Claude Code` on its own line, so the review reads as an independent machine pass, not a human sign-off

## The marker, the scans, and the post

### The marker every body carries

End every body with this line, carrying `<headRefOid>` and `<read-at>` from Step 1 verbatim:

```markdown
<!-- review-pr: commit=<headRefOid> read-at=<read-at> -->
```

Every body this step writes carries it, being the full body under either heading, both ✅ close-out lines, a withdrawal body, and the `PUT` rewrite in `close-out.md`. A body missing it reads as a pre-marker pass, so the next reader falls back to the stamps and the pass loses its coverage.

- Last is load-bearing, since `canon pr review-state` reads the last non-empty line and searches nowhere else
- That position also lets a finding quote the format safely, even in a fence, since a quotation is never the line the reader takes
- Write it as an HTML comment, which GitHub renders as nothing, so a reader of the thread never meets it

### Why the marker exists

GitHub stamps `commit.oid` and `submittedAt` at submission, not at read. A push landing in the compose window moves both onto a commit this pass never opened, and the next pass reads it as covered.

The marker is the read-time record those fields are not.

- `canon pr review-state` is the one place it is parsed, so Step 2 and the orchestrator poll read one answer rather than each copying the format
- It is inert data, so `canon labels scan` has nothing to fire on
- Confirm that against the posted body, since a phase label or board identifier inside a commit sha is not a shape either scan was written against

### The scans

Before posting, run `canon labels scan --body-file .canon/tmp/pr/review/body-<number>-<short-sha>.md`, which applies the rule in `${CLAUDE_SKILL_DIR}/../git-pr/references/publish.md`. Pass `--json` and fix the body and scan again on a finding.

- A `density` entry is a finding here, naming a subject or nested bullet past 200 characters, a run past 5 plain bullets, or a paragraph past its limits, by its line in the whole body
- Density never sets the exit code, so the hook below lets the post through on it and this step is the one that stops

- A finding phrased against an internal phase label is what the label half of the scan catches here
- The call carries no `--title`, so the scan reads the text as a review

A `PreToolUse` hook on `Bash` runs the same scan against the `-F body=@<file>` of the post and denies the call on a hit, so the check holds whether or not this step ran. The hook reads the file before the command runs, so write the body in an earlier call and pass it as a file rather than inline.

### The post-trigger re-read

`phase-label-gate.yml` reads the same text again once posted, on its `pull_request_review` trigger, which covers a review a person posts by hand with no hook in front of it.

- That workflow reaches every target on the `base` stack, seeded at `tooling/base/configs/.github/workflows/phase-label-gate.yml`
- It invokes the published CLI rather than a checkout's own source tree, so a target gets the same re-read past the hook

### The post

Do not run the command below when `<prior-heading>` from Step 2 reads `## Review closed` and this pass carries nothing owed. Read `${CLAUDE_SKILL_DIR}/references/close-out.md` instead, since posting first leaves two close-outs both naming the new head.

```bash
gh api -X POST 'repos/{owner}/{repo}/pulls/<number>/reviews' -f event=COMMENT -F body=@.canon/tmp/pr/review/body-<number>-<short-sha>.md --jq .html_url
```

- The post uses the REST reviews endpoint, since the `gh pr` review subcommand runs on GraphQL and fails where a cloud session's proxy refuses it
- `event=COMMENT` submits the review as a comment, the same state the old `--comment` flag produced
- A pass carrying nothing, a withdrawal, or only answered requests takes a close-out body, and only minors keep the full shape, per `${CLAUDE_SKILL_DIR}/references/body-variants.md`
