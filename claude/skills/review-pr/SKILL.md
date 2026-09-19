---
name: review-pr
description: Reviews an open pull request from an independent session and posts findings as a review comment on the PR. Posts a first pass against the whole change and every later pass against only the commits added since, under `## Review` while any finding is open and `## Review closed` once a pass carries none. Reads project docs and the task board for cross-feature context a self-review lacks. Use when asked to "review the PR", "review this feature's PR", "post a PR review", "re-review the PR", "close out the review", "confirm the findings are fixed", or acting as the orchestrator reviewing a worker's PR. Do NOT use to review local uncommitted changes. That is `review-branch`.
---

# Review PR

This is the orchestrator's independent review, distinct from `review-branch`.
`review-branch` reviews local changes for the session that wrote them and writes
to disk. This one reviews an open PR the session did not write and posts the
findings to the PR, so the vantage is independent and the output is durable.

It posts at least twice over a pull request's life. A first pass opens the
review against the whole change, and every later pass reads only the commits
added since. The heading reports state rather than pass number: a pass carrying
anything owed takes `## Review`, and `## Review closed` covers a pass carrying
none, so the most recent comment's heading reports whether any work is owed.
Owed is a finding at any severity, a Testing question, or a reviewer request nobody has answered, defined once at Step 4. Every pass is this skill, and which one it is gets detected from
the thread rather than named by the caller.

One live verdict stands at a time. A pass that would repeat a standing
close-out rewrites that comment in place rather than posting beside it, so a
reader scanning the thread finds the current verdict where the last one sat.

## Guards

- If no open PR resolves for the target branch via `gh pr view`, stop: `❌ No open PR to review. Open one first, or use /review-branch for local changes.`
- Review and post. Do not merge. Merging is the human's gate.

## Step 1: resolve the PR and read context

Capture `<read-at>` first, ahead of every read this pass makes:

```bash
date -u +%Y-%m-%dT%H:%M:%SZ
```

Everything from that line to the post is the compose window, and a commit pushed inside it is one this pass never saw. Stamping the body with the instant the window opened is what leaves that commit outside the covered range, so the next pass reads it rather than assuming it covered. Taking the stamp later, at the head resolution below or at Step 4 where the body is composed, claims a stretch this pass had already stopped reading through.

Then resolve the PR: `gh pr view --json number,headRefName,headRefOid,title,body` for the current branch, or use a PR number the user names. Take `<headRefOid>` from `canon pr head <number> --json`, off that record's `tip`, and fall back to the `headRefOid` field above when no record comes back, which is a target whose CLI predates the verb. The first seven characters are `<short-sha>`, which names the body file in Step 4.

`<headRefOid>` and `<read-at>` travel together into Step 4's marker, and neither is re-derived after this point. Re-reading the head later in the pass would name a commit this pass did not review, which is the defect the marker exists against, reached from the inside.

Read these in parallel from the project root, skipping any that do not exist:

- `CLAUDE.md`: project type, conventions, and commands
- `canon/REQUIREMENTS.md`: feature scope and non-goals
- `canon/ARCHITECTURE.md`: technical design decisions
- `.canon/tasks/priority.md`: where this feature sits on the board and what each neighboring row waits on. Resolve this one at the main worktree root the way `session-worktree` does, since the board is gitignored and a linked worktree holds no copy of it
- `.canon/plans/feature-<slug>.md` for the branch, when present: the intent the PR should satisfy

Coding standards from `.claude/rules/` are auto-loaded by Claude Code.

## Step 2: scope the read

Find the commit the last pass covered and the verdict it posted:

```bash
canon pr review-state <number> --json
```

The fields are `<prior-oid>` off `commit`, `<prior-heading>` off `heading`, and `<prior-at>` off `readAt // submittedAt`. The commit scopes the read below, the heading feeds the repeat guard at the end of this step, and the instant scopes the reply query further down, so one call answers all three rather than three reads of the same review. Branch on the record rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

`source` says which stamp answered. `marker` is the pass's own read-time record and is the authority. `fallback` is a pass posted before this mechanism shipped, so its commit is whatever the head was when GitHub recorded the review rather than what that session read, and a push inside its compose window is invisible. `none` is a thread carrying no pass at all.

Do not read `commit.oid` or `submittedAt` off `gh pr view --json reviews` here. Both are stamped at submission, so a push landing between a pass's read and its post moves them onto a commit that pass never saw, and this step then scopes the delta past it and reports it covered. That fired for real on a pull request in this toolkit on 2026-09-07, and what it skipped was a genuine fix.

A target whose CLI predates the verb meets a missing subcommand rather than a record. Fall back there to the jq below, which reads the stamps and carries the defect above, and say the fallback answered so a reader can tell a marker read from a stamped one:

```bash
gh pr view <number> --json reviews --jq '[.reviews[] | select(.body // "" | split("\n")[0] | rtrimstr("\r") | . == "## Review" or . == "## Review closed")] | last | select(. != null) | ((.commit.oid // "") + "\t" + (.body | split("\n")[0] | rtrimstr("\r")) + "\t" + (.submittedAt // ""))'
```

The three fields are `<prior-oid>`, `<prior-heading>`, and `<prior-at>`. Keep the `select(. != null)` guard, since the string concatenation aborts jq on the null an empty selection returns, and an aborted command reaches the session as an error rather than as the empty result the first-pass branch reads.

Match the first line for equality against the two headings this skill posts. A prefix test also matches `## Review response` and any heading merely starting with those words, which would scope the pass to whatever commit that comment carried. The `\r` trim covers a body composed in the GitHub web editor, which stores CRLF.

A `source` of `none`, or an empty result from the fallback, is a first pass. Read the whole change:

```bash
gh pr diff <number>
```

```bash
gh pr diff <number> --name-only
```

A commit is a later pass. Fetch the pull request head so both commits are local:

```bash
git fetch -q origin pull/<number>/head
```

A failed fetch stops the skill: `❌ Could not fetch the PR head. Retry once the remote is reachable.` Do not fall through to the full pass. A fetch failure and a rebase both leave the prior commit unreachable, and the fallback below states a rebase as fact on the pull request, so conflating the two publishes a claim the skill never checked.

Then test that the prior commit still reaches the head:

```bash
git merge-base --is-ancestor <prior-oid> <headRefOid>
```

On exit zero, review `<prior-oid>..<headRefOid>` and nothing else. `git diff` and `git log --oneline` over that range are the whole read, because the first pass already covered everything behind it. A non-zero exit means the branch was rebased or force-pushed, so the delta is undefined rather than empty. Fall back to the full pass above and say so in the body.

A commit is its own ancestor, so an unchanged head passes that test too, with an empty range. When `<prior-oid>` equals `<headRefOid>`, decide whether this pass has anything to add before reading anything else, since the empty range itself cannot answer that:

```bash
gh pr view <number> --json comments --jq '[.comments[] | select(.body // "" | split("\n")[0] | rtrimstr("\r") | . == "## Review response" or . == "## Rebase" or . == "## Post-review findings") | select(.createdAt > "<prior-at>")] | last | .url // empty | split("-") | last'
```

`<prior-at>` is the instant Step 2 resolved above, which is the prior pass's `readAt` where it wrote one. Reading `submittedAt` off the thread here instead is the same submission-time defect on the time axis: a reply posted inside that pass's compose window sorts before the stamp and reads as already answered, when in fact the pass had stopped reading before it landed.

Scope the replies to those newer than the prior pass, never to every reply the thread carries. A pass answering the newest reply and a pass answering an older one derive the same third segment (Step 4), so an unscoped read hands a re-run after a close-out the name its own prior pass already wrote. That is the collision this case exists to prevent, reached without a rebase or an error.

Read the number off `.url`. The `id` field carries a GraphQL node id, which the thread never displays. Keep the `// empty` guard, since `split` aborts jq on the null an empty selection returns, and an aborted command reaches the session as an error rather than as the empty result the stop below reads.

An empty result means no reply arrived since the prior pass, so the head is unchanged and this pass has nothing new to add. Stop here, before Step 3 or Step 4 run: `❌ The head is unchanged since the prior pass on <short-sha>. Nothing new to review.` This is the earliest point every path crosses, which is why the check sits here rather than inside Step 4's filename derivation. A path that decides there is nothing to add never reaches a step reached only when composing a body, so a stop written there is a stop a shortcut path can route around.

A non-empty result carries the comment id Step 4 needs for the third filename segment. A `## Review response` or a `## Rebase` reply answers a finding already argued or reports a stale branch resolved without one, so read it for what the worker changed or accepted, treat an accepted finding as closed rather than restating it, and skip the diff and file reads below. This is the entire read on a repeated head for either heading, since the empty range above has nothing in it to say whether a prior finding landed and neither reply needs anything more to answer that.

A `## Post-review findings` reply carries no argued finding behind it, since it asserts a new defect rather than answering one, and this pass is its first independent reader. Restating it as a finding without opening anything is repeating the worker's claim rather than checking it. Read the file the comment names at `<headRefOid>`, the same `git show <headRefOid>:<path>` read Step 3 already runs to confirm a ticked box, and confirm the defect before it becomes a finding of this pass's own.

A moved head has its own way to add nothing, which the ancestor test cannot see. When `<prior-heading>` reads `## Review closed`, the standing verdict already reports the branch clear, so a pass over the new commits that raises nothing posts a comment saying what the one above it said. Two close-outs landed that way on 2026-08-28, and the operator caught the pair rather than any check.

The producing shape is narrow. A prior pass tells the author a change is their own call, the author makes it, and the delta reaching the next pass has nothing left to say by construction.

Carry `<prior-heading>` into Step 4 and run Step 3 unchanged. This guard cannot stop the pass the way the unchanged-head stop above does, because that stop reads an empty range and this one turns on what the pass carries, which is Step 3's output. Deciding ahead of the review would swallow the pass that does find something, and that is the costlier error, so the rule is stated beside its sibling and executed where the heading is picked.

Read each changed file in scope. Skip deleted files. Run reads in parallel.

## Step 3: review

Review the diff and files for the same axes as `review-branch` (bugs, edge cases, error handling, logic flaws, security, rule violations, checkout assumptions in a shipped file), then add the three lenses a self-review structurally cannot apply:

- Integration: does this fit the board's order, the shared wiring seam, and any sibling PR in flight?
- Contract: does a contract downstream features depend on land correctly, and should the plan itself be questioned?
- Consumers: when the change touches a resource with more than one consumer, enumerate them and check the rule against each. A rule written for the consumer the change targets can be wrong for a sibling that writes.

Read each test file the branch added or changed against the final filter in `canon:test-craft`, which owns what the filter asks. Scope it to those files rather than the suite. A fixed-pause wait is a `should-fix`, since the end to end rules already forbid it, and a test sitting at a higher layer than it needs is `minor` unless it is flaky or slows the gate measurably. Report it rather than proceeding silently when the skill does not resolve.

Then read the description's `## Testing` section, which is the one part of a pull request body this session is positioned to falsify. The branch author cannot see what a sibling branch drove the same day, and the arm list is what settles the claim rather than the diff.

Test every unchecked box against the testing discipline in `${CLAUDE_SKILL_DIR}/../../standards/pr.md`, which reserves an unchecked box for a capability the agent lacks. Raise the box when it names no human at all, when the human it names is a live agent session, or when it names a person for a step the repository ships a harness for, `scripts/sandbox/run.sh` and `scripts/eval/run.sh` being the two. Cost alone is not an answer, since authorizing a spend is the operator's and performing the run is not. A refusal the author actually met is an answer, and it names which one.

Test every ticked box too, bounded to one naming a file or a command. Confirm what it names still exists at `<headRefOid>`, `git show <headRefOid>:<path>` for a file or `git grep <command> <headRefOid>` for a command, rather than re-running what it claims. A box naming neither stays untested, since nothing here can confirm a claim carrying no artifact. A box ticked before a later commit removed or replaced what it names is a `should-fix` finding on the body itself, filed under a `**PR body**` block ahead of the file blocks, since what it corrupts is the merge record rather than a file in the diff.

Test what `## Key Changes` claims against the diff it describes, with `canon pr key-changes <number> --json`. This repository squash-merges, so that section becomes the commit message and the record on the trunk once the branch is gone, which is the same thing a stale ticked box corrupts. Branch on the record rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

Read `unmet` as a `should-fix` finding under the same `**PR body**` block the stale box takes, one entry per path, quoting the bullet the record carries on `preview` and naming the `head` the comparison ran at. Read the bullet before filing it, since one class survives the reader: a bullet citing where something is defined while claiming an edit elsewhere, which puts a real path in the claim region and points the change at a locative the path does not name. Report that as the class rather than as a stale claim. A body is edited between pushes, so the reading is true at that commit and can be false a minute later. Read `unnamed` for yourself and raise nothing off the count. The class still covers a real omission and equally a generated asset or a regenerated index that earns no bullet, and the entries the reader can name as owing none are already held apart under `incidental`. Open the section and confirm no bullet names the file before putting a single one to the author, because this instruction has sent the question to three pull requests in one day over bullets that had named the files all along, and one of those authors added bullets nobody needed. Report `unresolved` and `incidental` nowhere: the first was judged in neither direction and the second owes no bullet, so neither says anything about the body.

A `reason` of `no-claims` means the reader resolved no path out of a section that exists, which is the extractor failing over prose rather than the body being wrong. Say so and raise nothing. `no-section` is the body carrying no such heading, which is a finding only where the pull request template asks for one.

Compose this on the body read Step 4 already performs rather than opening a second one. That step scans the title and body for a leaked phase label, and both reads answer from the same text at the same head.

Ask rather than grade. Whether a human is genuinely required is a reading the branch author may hold a reason this session cannot see, so the question carries no severity and enters no count. What it does carry is the heading and the dispatch, on the rule Step 4 states, because a question the author never receives corrects nothing and the author is the only party who can answer it. Answering it closes it, and the answer may be that the requirement holds.

Read `## For the reviewer` the same way, bounded to the bullets under that heading rather than the Summary or the Technical Context around it. Those two carry the author's argument for the change, and reading them while judging it is most of what an independent pass exists to avoid, so the read stops at the section itself.

Answer each bullet in the body, on the same terms as a Testing question: no severity, no count. A request nobody can answer stays owed under the heading and dispatch Step 4 states, keeping the thread open exactly as an unanswered Testing box does. One the pass does answer carries no further weight, since the answer is discharged in the same comment that carries it.

Apply the high-signal filter: flag only what will cause incorrect behavior, break a documented rule, or mislead a downstream feature. If uncertain, do not flag.

A later pass applies the same axes to the delta, and adds one check the first pass cannot make: did each prior finding land, and did the fix regress anything it touched. Findings of its own are normal findings, stated at the same severity and counted the same way. That count is one of the two things Step 4 reads to pick the heading, so a pass raising a finding of its own is not a close-out at any severity.

A prior finding can also be settled by argument rather than by a fix. A reply naming the plan question that already declined it, or a constraint this session could not see, withdraws the finding or moves its grade. State that outcome in the body under the finding it changes, naming the fact that produced it, whether the argument arrived on the thread or through the channel that carried the dispatch. Dropping the finding from this body instead leaves a reader unable to tell a withdrawal from an oversight, and the reasoning goes with the session that heard it. A withdrawal removes the finding from the count, so a pass that withdrew every finding it carried is a close-out. Write the withdrawal and its cause into that body rather than taking the short close-out line Step 4 supplies, which reports prior findings addressed and would credit a fix nobody made.

Use severity: `critical` (blocks merge), `should-fix` (fix before merge), `minor` (blocks nothing). The ladder ranks a finding and decides nothing about who acts on it, since every grade takes the open heading and owes a dispatch under the threshold Step 4 states.

## Step 4: post to the PR

Write the comment to `.canon/tmp/pr/review/body-<number>-<short-sha>.md` at the main worktree root, not the current worktree, which the rest of this step calls `<body-file>`. Resolve that root the way `session-worktree` does, and send the write as a plain single `Bash` command carrying a heredoc from a linked worktree, since `Edit` and `Write` refuse a main-root path there. The PR number stops two sessions reviewing different pull requests from overwriting each other between the write and the post, and the head commit stops a second pass overwriting the first one's body.

Derive both segments from Step 1. Never pick a suffix by hand, and never reuse a name the folder already holds.

When `<prior-oid>` from Step 2 equals `headRefOid`, the head repeats and the folder already holds `body-<number>-<short-sha>.md`. Add a third segment taking the id of the reply Step 2 resolved, giving `body-<number>-<short-sha>-r<comment-id>.md`, which is `<body-file>` on that path. That satisfies both prohibitions above rather than carving an exception into either. Step 2 already stopped the pass when that resolution came back empty, so reaching this line means the comment id is in hand.

The comment is a rendered-for-human GitHub surface, so load the `write-human` skill for voice and follow `${CLAUDE_SKILL_DIR}/../../standards/markdown.md` for the banned words: cut editorializing, and keep every sentence load-bearing. Match this shape on a first pass:

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

The threshold is stated here and nowhere else, and every other surface acting on it cites this skill rather than restating the grades. One rule governs both the heading and the dispatch: a pass carrying anything owed takes `## Review` and owes a dispatch to the session holding the branch, and a pass carrying nothing at all takes `## Review closed` and owes none. Owed covers a finding at any severity, a Testing question, and a reviewer request nobody has answered alike, which is what keeps the two halves from separating. Sending that dispatch is `role-orchestrator`'s step rather than this one, which posts and stops. Post the open heading whether it is the first pass or the fourth. A pull request thread then reads as `## Review`, the worker's answer under `## Review response` from `review-address`, another `## Review` while anything stays open, and `## Review closed` when nothing does.

Keying either half on the grade was measured wrong: across 8 findings on one archived pass, 3 were posted as minor and 2 of those were defects a worker fixed rather than recorded, so a floor at should-fix loses real fixes to a grade that runs low. Splitting the two halves so the dispatch fired lower than the heading was the other candidate, and it left a thread reading closed while work was owed on it. The Testing question was first written to sit outside both, which is that same split reached from the other side, and it left the one party who could answer the question with no route to it.

The cost is that the merge decision no longer reads off the heading alone, since an open heading covers a minor as well as a critical. Take it from the counts on the summary line, which is where they already sit. No summary line reports the merge as unblocked under either heading, since a thread reading open cannot also report that nothing blocks it.

A minor the dispatched worker declines is what needs a surface that survives the merge, rather than every minor, since one that gets fixed on the branch needs no durable record. Write a declined minor into the `## Findings` section of the task the branch closes, which is where the queue-refill sweep already routes a finding that changes another task. A declined finding left on the thread alone is lost the moment the pull request merges.

Read the state off the most recent review comment rather than off the presence of a closed one. A close-out does not close the pull request, so a commit pushed after it gets its own pass, and that pass reopens the review under `## Review` when it raises a finding of any grade.

Both of this skill's headings anchor as a section distinct from human threads, and neither invents beyond what the whole set already states. That set is six headings across three families, stated here once so `role-orchestrator`'s poll and every reply-posting skill cite it rather than carry a copy. The review family, `## Review` and `## Review closed`, belongs to this skill alone. The reply family, `## Review response`, `## Rebase`, and `## Post-review findings`, belongs to `review-address`. The third family is a single heading, `## Evidence`, which `canon pr evidence` posts through `git-pr` and `git-followup` and which answers no comment already on the thread, so the poll excludes it from the unclassified count without reading it as a reply that owes a re-review.

The first reply heading answers a finding this skill posted, the second reports a stale branch resolved without one, and the third carries a finding a worker produces after a close-out rather than in answer to one already on the thread, since a finding produced late is still a finding. A comment posted under a heading outside these six reaches the poll as unclassified rather than as silence, so an invented seventh heading is a gap the next run reports instead of one it repeats. Do not append the PR number, which GitHub already renders above the comment.

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

Every body this step writes carries it, with no exception: the full body under either heading, both ✅ close-out lines, a withdrawal body, and the `PUT` rewrite at the end of this step. A body missing it reads as a pre-marker pass, so the next reader falls back to the stamps and the pass loses the coverage it actually had.

Last is load-bearing rather than tidy. `canon pr review-state` reads the last non-empty line and searches nowhere else, so a marker written above the footer is a marker the next pass does not see. That position is also what lets a finding quote the format safely, including inside a fenced block, since a quotation is never the line the reader takes.

It is what the review is scoped from. GitHub stamps `commit.oid` and `submittedAt` when a review is submitted, not when it was read, so a push landing in the compose window moves both onto a commit this pass never opened and the next pass reads that commit as covered. The marker is the read-time record those two fields are not, and `canon pr review-state` is the one place it is parsed, so Step 2 here and the orchestrator poll read one answer rather than each carrying a copy of the format.

Write it as a comment rather than as prose so a reader of the thread never meets it. HTML comments render as nothing on GitHub, which is why the fact travels here rather than in a footer line a person would have to be told to ignore.

It is inert data, so the `publish.md` scan below and `canon labels scan` have nothing to fire on. Confirm that against the posted body rather than assuming it, since a phase label or a board identifier appearing inside a commit sha is not a shape either scan was written against.

Before posting, run the scan in `${CLAUDE_SKILL_DIR}/../../standards/publish.md` against the body. The hook skips `.canon/tmp/`, so this scan is the only gate ahead of the post. A finding phrased against an internal phase label is what the label half of the scan catches here. This repository reads the same text again once posted, on `phase-label-gate.yml`'s `pull_request_review` trigger, which is what closes the gap this scan leaves open for a review a person writes and posts by hand with no scripted step in front of it. That workflow now reaches every target on the `base` stack, seeded at `tooling/base/configs/.github/workflows/phase-label-gate.yml` invoking the published CLI rather than this checkout's own source tree, so a target's coverage extends past this pre-post scan to the same post-trigger re-read this repository gets.

Do not run the command below when `<prior-heading>` from Step 2 reads `## Review closed` and this pass carries nothing owed. That pass replaces the standing comment rather than adding one, under `### A close-out that repeats the standing one` at the end of this step. Posting first and reaching that section afterward leaves two close-outs both naming the new head, which is worse than the pair the guard exists against.

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

### A close-out that repeats the standing one

When `<prior-heading>` from Step 2 reads `## Review closed` and this pass carries nothing owed, the thread already holds this verdict. Replace the standing close-out rather than posting a second one beside it.

Resolve its numeric id. `gh pr view --json reviews` carries a GraphQL node id under `id`, which no REST route accepts, so read the id off the REST listing instead:

```bash
gh api repos/{owner}/{repo}/pulls/<number>/reviews --jq '[.[] | select((.body // "") | split("\n")[0] | rtrimstr("\r") == "## Review closed")] | last | .id'
```

Write the replacement body to `<body-file>`, the name Step 4 already derived at the top of this step, keeping the heading and the footer and naming what this pass covered on the scope line in place of what the old one covered. Derive that name the same way whichever path reached here, since the guard reads `<prior-heading>` alone and a repeated head resolves the third segment as usual. The folder then gains a record of every covered head rather than losing the one the standing comment named. Then replace the comment:

```bash
gh api -X PUT repos/{owner}/{repo}/pulls/<number>/reviews/<review-id> -F body=@<body-file>
```

`PUT` keeps the comment's timestamp and its position in the thread, so the verdict stays where a reader already found it and the thread gains no second entry. A submitted review cannot be deleted, which is why this rewrites the standing comment rather than posting a fresh one.

The guard fires on `## Review closed` alone. Two open passes carry different findings and both are worth reading, so a repeated `## Review` posts normally. A pass carrying anything owed posts normally too, under `## Review`, which is what keeps a finding raised after a close-out from being swallowed by the guard that exists for a silent one.

The rewrite used to cost the review's `commit.oid`, which `PUT` leaves pinned at the commit the standing close-out was first submitted against. Step 2's `<prior-oid>` and the prior commit `poll.sh` derives both read that field, so the next pass read a range wider than its delta, and the poll's `SEEN` branch, which fires on `prior` equalling the head, could never be reached at all: an out-of-band pass reported as `MOVED` for the rest of the pull request's life.

The marker closes both, because `PUT` replaces the body and the marker is in it. The rewritten close-out carries the commit this pass read rather than the one the comment was first submitted against, and every reader now takes that in preference to the pinned field. The one thing `PUT` still cannot move is `submittedAt`, which stays at the original submission and is what the poll's age test reads, so a rewritten close-out ages from when it first landed rather than from when it was last rewritten. That is the correct reading for a thread waiting on a human, which is the question the age test asks.

## Step 5: output

```plaintext
X critical, Y should-fix, Z minor. Posted to PR #<number>.
```

Add `N Testing question(s) raised.` to that line when the Step 3 check raised any. The counts cover findings alone, so a pass whose only output was a question otherwise reports as silent to the session that drove it. That session is not who the question is addressed to, which is what the dispatch covers.

Add `N reviewer request(s) answered.` to that line when the PR body carried a `## For the reviewer` section. The counts and the Testing question line both cover something else, so a pass that only answered a request otherwise reports as silent too.

Report the merge decision as a plain recommendation in chat (merge, or address findings first). Do not merge.
