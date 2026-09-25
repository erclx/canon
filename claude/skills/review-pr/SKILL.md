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
Every pass is this skill, and which one it is gets detected from the thread
rather than named by the caller.

The threshold is stated here and nowhere else, and every other surface acting on it cites this skill rather than restating the grades. One rule governs both the heading and the dispatch: a pass carrying anything owed takes `## Review` and owes a dispatch to the session holding the branch, and a pass carrying nothing at all takes `## Review closed` and owes none. Owed covers a finding at any severity, a Testing question, and a reviewer request nobody has answered alike, which is what keeps the two halves from separating. Sending that dispatch is `role-orchestrator`'s step rather than this one, which posts and stops. Post the open heading whether it is the first pass or the fourth. A pull request thread then reads as `## Review`, the worker's answer under `## Review response` from `review-address`, another `## Review` while anything stays open, and `## Review closed` when nothing does.

Both of this skill's headings anchor as a section distinct from human threads, and neither invents beyond what the whole set already states. That set is six headings across three families, stated here once so `role-orchestrator`'s poll and every reply-posting skill cite it rather than carry a copy. The review family, `## Review` and `## Review closed`, belongs to this skill alone. The reply family, `## Review response`, `## Rebase`, and `## Post-review findings`, belongs to `review-address`. The third family is a single heading, `## Evidence`, which `canon pr evidence` posts through `git-pr` and `git-followup` and which answers no comment already on the thread, so the poll excludes it from the unclassified count without reading it as a reply that owes a re-review.

The first reply heading answers a finding this skill posted, the second reports a stale branch resolved without one, and the third carries a finding a worker produces after a close-out rather than in answer to one already on the thread, since a finding produced late is still a finding. A comment posted under a heading outside these six reaches the poll as unclassified rather than as silence, so an invented seventh heading is a gap the next run reports instead of one it repeats.

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
- `.canon/plans/feature-<slug>.md` for the branch, when present: the intent the PR should satisfy, and its `**Review focus:**` section as the inputs this pass must confirm the diff handles

Coding standards from `.claude/rules/` are auto-loaded by Claude Code.

## Step 2: scope the read

Read `${CLAUDE_SKILL_DIR}/references/scope.md` for finding the commit and verdict the prior pass left, the unchanged-head stop, and the range this pass reads. Read it before Step 3, since its stop ends the pass ahead of any review.

## Step 3: review

Invoke `canon:review-craft` with the skill tool now, and read nothing for findings until it has loaded, whatever the diff's size. It carries what to look for and how much evidence a finding needs, rendered output included, and this step carries no axis list of its own to fall back on. Read the diff and files against its axes. Add the two that stay here: rule violations, and checkout assumptions in a shipped file. Report it rather than proceeding silently when the skill does not resolve. Then add the three lenses a self-review structurally cannot apply:

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

Ask rather than grade. Whether a human is genuinely required is a reading the branch author may hold a reason this session cannot see, so the question carries no severity and enters no count. What it does carry is the heading and the dispatch, on the rule the opening states, because a question the author never receives corrects nothing and the author is the only party who can answer it. Answering it closes it, and the answer may be that the requirement holds.

Read `## For the reviewer` the same way, bounded to the bullets under that heading rather than the Summary or the Technical Context around it. Those two carry the author's argument for the change, and reading them while judging it is most of what an independent pass exists to avoid, so the read stops at the section itself.

Answer each bullet in the body, on the same terms as a Testing question: no severity, no count. A request nobody can answer stays owed under the heading and dispatch the opening states, keeping the thread open exactly as an unanswered Testing box does. One the pass does answer carries no further weight, since the answer is discharged in the same comment that carries it.

On a first pass, confirm each `**Review focus:**` item the plan names against the diff, since the planning session named the inputs that would break the change before any code existed and no other reader holds that list. Report the items in a `**Review focus**` block after the `**For the reviewer**` block, one bullet per item naming what confirmed it, such as a test, a guard, or a branch in the code. The block carries no severity and enters no count. An item the pass cannot confirm becomes a `should-fix` finding under the file that should have handled it, so a reader can tell an item checked from one skipped. A plan whose section reads `None identified.`, or a branch with no plan, takes no block. The section binds the first pass only: a later pass checks whether the finding an unconfirmed item became has landed, like any other prior finding, and never re-raises a confirmed item against a delta that did not touch it.

Apply the high-signal filter: flag only what will cause incorrect behavior, break a documented rule, or mislead a downstream feature. If uncertain, do not flag.

A later pass applies the same axes to the delta, and adds one check the first pass cannot make: did each prior finding land, and did the fix regress anything it touched. Findings of its own are normal findings, stated at the same severity and counted the same way. That count is one of the two things Step 4 reads to pick the heading, so a pass raising a finding of its own is not a close-out at any severity.

A prior finding can also be settled by argument rather than by a fix. A reply naming the plan question that already declined it, or a constraint this session could not see, withdraws the finding or moves its grade. State that outcome in the body under the finding it changes, naming the fact that produced it, whether the argument arrived on the thread or through the channel that carried the dispatch. Dropping the finding from this body instead leaves a reader unable to tell a withdrawal from an oversight, and the reasoning goes with the session that heard it. A withdrawal removes the finding from the count, so a pass that withdrew every finding it carried is a close-out. Write the withdrawal and its cause into that body rather than taking the short close-out line Step 4 supplies, which reports prior findings addressed and would credit a fix nobody made.

Use severity: `critical` (blocks merge), `should-fix` (fix before merge), `minor` (blocks nothing). The ladder ranks a finding and decides nothing about who acts on it, since every grade takes the open heading and owes a dispatch under the threshold the opening states.

## Step 4: post to the PR

Read `${CLAUDE_SKILL_DIR}/references/post.md` for the body file name, the body shape for each pass, the Testing, reviewer, and PR body blocks, the marker every body carries, and the scans ahead of the post. That file sends a pass repeating a standing close-out on to `${CLAUDE_SKILL_DIR}/references/close-out.md`, which rewrites the comment in place.

## Step 5: output

```plaintext
X critical, Y should-fix, Z minor. Posted to PR #<number>.
```

Add `N Testing question(s) raised.` to that line when the Step 3 check raised any. The counts cover findings alone, so a pass whose only output was a question otherwise reports as silent to the session that drove it. That session is not who the question is addressed to, which is what the dispatch covers.

Add `N reviewer request(s) answered.` to that line when the PR body carried a `## For the reviewer` section. The counts and the Testing question line both cover something else, so a pass that only answered a request otherwise reports as silent too.

Report the merge decision as a plain recommendation in chat (merge, or address findings first). Do not merge.
