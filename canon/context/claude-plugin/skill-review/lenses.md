---
title: Lenses
description: The review lenses that read the pull request body rather than the diff, from the testing question to the key-changes claim check
---

# Lenses

`review-pr` Step 3 reads the diff through the ordinary lenses and three sections of the pull request body through lenses of their own. Each lens reads one section and neither its neighbors nor the rest of the body.

The Summary and Technical context carry the author's argument for the change. A pass reading that argument while judging the change loses the independent vantage a review exists for.

## Decisions

### The testing question

The lens reads `## Testing` against what the repository can drive. That section is the one claim a reviewing session can falsify, since the branch author cannot see what a sibling branch drove the same day.

It asks rather than grades, because the author may hold a reason a human is required. The question carries no severity and enters no count.

- It sits under the unified threshold, since a question riding on a close-out would land on a thread reporting nothing owed and the dispatch would never fire
- The threshold reads anything owed rather than any finding, and the summary line names the question count beside the three that stay zero
- It tests against `claude/skills/git-pr/references/pr.md`, where a human is required for a capability the agent lacks, never for the cost of the run
- A refusal the author actually met counts and names itself, and one predicted and never met does not

`review-pr` reads that file through `${CLAUDE_SKILL_DIR}/../git-pr/references/pr.md`, the route every skill citing it from outside `git-pr` takes.

### The stale ticked box

A second check reads the opposite half of the same section, a ticked box. A box stays true only while what it names does, and a fix commit landing after review can replace a test the box names and leave the merge record claiming it.

- The check is bounded to a box naming a file or a command, since a claim with no artifact has nothing to confirm
- It tests that the artifact still exists rather than re-running the claim, so a review never becomes a test run

A stale ticked box carries severity and enters the count. It is a factual claim the body still makes, not a judgment the author is owed a chance to defend.

### Resolving the head for the existence check

Existence keys off `<headRefOid>` rather than local `HEAD`. `review-pr` never checks out the branch it reviews, so a read against `HEAD` would resolve the reviewing session's own branch, a silent wrong answer rather than a missing one.

- Step 2 reads the diff and file contents through REST `gh api` calls and `git fetch -q origin pull/<number>/head`
- The head comes from the `tip` of `canon pr head --json`, since a pull request object's own field can trail the branch ref by up to a minute after a push
- Step 1 still reads `number`, `headRefName`, `title`, and `body` in one `gh` call, at the cost of one extra remote round trip for the head
- The `<short-sha>` naming the Step 4 body file comes from the same tip, so the body file and the ancestor test name one commit

### The reviewer request section

`claude/skills/git-pr/references/pr.md` defines `## For the reviewer` as what the reviewer should confirm, one bullet per request, read by the reviewing session. The lens reads that section and stops there.

Answering a request takes the testing question's shape rather than new machinery. An item that is not a finding still has to survive to a reader, avoid the merge-blocking counts, and keep the thread open until settled. Its output block sits beside the Testing block in Step 4, as its lens sits beside the Testing lens in Step 3.

### When a request is owed

Owed narrows to a bullet the pass could not answer, not every bullet the section carries. Treating every bullet as owed would force the open heading and a dispatch on every pull request with the section, though the same pass normally discharges the request. A testing question differs, since it stays owed until the author answers on a later pass.

A pass whose bullets are all answered takes the closed heading, with the block standing in for the canned line. A withdrawn finding already takes that shape.

### The key-changes claim check

Step 3 also checks `## Key changes` through `references/key-changes.md`. `canon pr key-changes` compares the paths that section claims against the pull request's changed-file list. A claim the diff does not carry is filed under the `**PR body**` block the stale ticked box takes, since both corrupt the merge record rather than a file in the diff.

The check composes on the body read Step 4 already does. A second read of one text at one head is a second place for the head to be wrong. `canon pr key-changes --help` carries the direction split.

### How a claim is read

The section is read alone, since `## Technical context` names files a branch never touched by design.

- A bullet's claim region ends at its first comma, because a clause past it usually names context and would read as a false claimed-but-untouched path
- `untouched`, `unchanged`, and `as written` void a bullet's claim outright when the bullet declines an edit rather than making one
- A path written partially, or one past the first comma, can credit a changed file and never accuse one, since nothing separates a short path from a wrong one or a second claim from a cited file

### Which direction is graded

Only the claimed-but-untouched direction is graded. A changed file no bullet names is reported without a severity. That class covers a real omission and equally a generated asset or a regenerated index, and grading it would fire on nearly every branch.

Each direction splits again on whether the evidence is worth raising with a person, and what a split sets aside is still reported.

- A test beside its subject, a fixture, and a lockfile owe no bullet by Step 3's standard, so they move from `unnamed` into `incidental`. A count mixing owed and unowed files cannot be acted on.
- A generated asset and a regenerated index are absent from that class, since neither has a spelling that holds outside one project and guessing could set aside a file that owed a bullet
