---
name: review-pr
description: Reviews an open pull request from an independent session and posts findings as a review comment on the PR. Posts a first pass against the whole change and every later pass against only the commits added since, under `## Review` while any finding is open and `## Review closed` once a pass carries none. Reads project docs and the task board for cross-feature context a self-review lacks. Use when asked to "review the PR", "review this feature's PR", "post a PR review", "re-review the PR", "close out the review", "confirm the findings are fixed", or acting as the dispatched reviewer of a worker's PR. Do NOT use to review local uncommitted changes.
metadata:
  family: after-pr
---

# Review PR

This is a dispatched reviewer's independent review. It reviews an open PR the session did not write and posts the findings to the PR, so the vantage is independent and the output is durable.

It posts at least twice over a pull request's life. A first pass reviews the whole change, every later pass reads only the commits added since, and which pass this is gets detected from the thread rather than named by the caller.

## The threshold

The threshold is stated here and nowhere else, and every other surface acting on it cites this skill rather than restating the grades. One rule governs both the heading and the dispatch.

- A pass carrying anything owed takes `## Review` and owes a dispatch to the session holding the branch, whether it is the first pass or the fourth
- A pass carrying nothing at all takes `## Review closed` and owes none, so the latest heading reports whether work is owed
- Owed covers a finding at any severity, a Testing question, and an unanswered reviewer request alike, which keeps heading and dispatch together
- Sending the dispatch is `role-reviewer`'s step, since this skill posts and stops. `role-orchestrator` sends it only where no live reviewer can.

A thread then reads as `## Review`, the worker's `## Review response` from `review-address`, another `## Review` while anything stays open, and `## Review closed` when nothing does.

## The heading set

Both headings anchor as a section distinct from human threads. The full set is eight headings across four families, stated here once so `role-orchestrator`'s poll and every reply-posting skill cite it rather than carry a copy.

| Family   | Headings                                                     | Owner                                                                       |
| -------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Review   | `## Review`, `## Review closed`                              | This skill alone                                                            |
| Reply    | `## Review response`, `## Rebase`, `## Post-review findings` | `review-address`                                                            |
| Evidence | `## Evidence`                                                | `canon pr evidence`, through `pr-evidence` from `git-pr` and `git-followup` |
| UI       | `## UI review`, `## UI review closed`                        | `review-ui`, posted as a review beside this one and read by nothing here    |

- The reply headings in order answer a finding, report a stale branch resolved without one, and carry a finding a worker produced after a close-out
- `## Evidence` answers no comment on the thread, so the poll leaves it out of the unclassified count rather than reading it as a reply owing a re-review
- A comment under any other heading reaches the poll as unclassified rather than as silence, so an invented ninth heading is a gap the next run reports

One live verdict stands at a time. A pass that would repeat a standing close-out rewrites that comment in place, so a reader finds the current verdict where the last one sat.

## Guards

- If no open PR resolves for the target branch via `canon pr head --json`, stop: `❌ No open PR to review. Open one first.`
- Review and post. Do not merge. Merging is the human's gate.

## Step 1: resolve the PR and read context

Capture `<read-at>` first, ahead of every read this pass makes:

```bash
date -u +%Y-%m-%dT%H:%M:%SZ
```

Everything from that line to the post is the compose window, and a commit pushed inside it is one this pass never saw. Stamping the window's opening instant leaves that commit outside the covered range, so the next pass reads it. A later stamp claims a stretch this pass had stopped reading.

### Resolve the head

Resolve the PR through `canon pr head --json` for the current branch, or `canon pr head <number> --json` for a number the user names. Take `<number>` off `number` and `<headRefOid>` off `tip`, whose first seven characters are `<short-sha>`, naming Step 4's body file. Read the title and body over REST:

```bash
gh api repos/{owner}/{repo}/pulls/<number> --jq '{title, body, head: .head.sha, repo: .base.repo.html_url}'
```

- Every read here runs on REST, since `gh pr` runs on GraphQL and a cloud session's proxy refuses it
- A target whose CLI predates the verb gets no record. Take `<headRefOid>` from the `head` field above instead.
- With no number named there, read `gh api "repos/{owner}/{repo}/pulls?head={owner}:<branch>&state=open" --jq '.[].number'`, and stop on the guard unless it prints one number
- `<headRefOid>` and `<read-at>` travel into Step 4's marker, and `<headRefOid>` with `repo` as `<repo-url>` into its links. Re-reading the head later would name a commit this pass did not review.

### Read the project context

Read these in parallel from the project root, skipping any that do not exist:

- `CLAUDE.md`: project type, conventions, and commands
- `canon/REQUIREMENTS.md`: feature scope and non-goals
- `.canon/tasks/priority.md`: where this feature sits on the board and what each neighbor waits on, resolved at the main root the way `session-worktree` does, since a linked worktree holds no copy
- `.canon/plans/feature-<slug>.md` for the branch, when present: the intent the PR should satisfy, and its `**Review focus:**` section as the inputs this pass must confirm the diff handles

Coding standards from `.claude/rules/` are auto-loaded by Claude Code.

## Step 2: scope the read

Read `${CLAUDE_SKILL_DIR}/references/scope.md` for finding the commit and verdict the prior pass left, the unchanged-head stop, and the range this pass reads. Read it before Step 3, since its stop ends the pass ahead of any review.

## Step 3: review

Invoke `canon:review-craft` with the skill tool now, and read nothing for findings until it has loaded, whatever the diff's size. It carries what to look for and how much evidence a finding needs, and this step has no axis list of its own to fall back on.

Read the diff and files against its axes, plus the two that stay here, being rule violations and checkout assumptions in a shipped file. Report it rather than proceeding silently when the skill does not resolve. Then add the three lenses a self-review structurally cannot apply:

- Integration: does this fit the board's order, the shared wiring seam, and any sibling PR in flight?
- Contract: does a contract downstream features depend on land correctly, and should the plan itself be questioned?
- Consumers: when the change touches a resource with more than one consumer, enumerate them and check the rule against each, since a rule right for the target can be wrong for a sibling that writes

### Tests

Read each test file the branch added or changed against the final filter in `canon:test-craft`, scoped to those files rather than the suite. Report it rather than proceeding silently when the skill does not resolve.

- A fixed-pause wait is a `should-fix`, since the end to end rules already forbid it
- A test at a higher layer than it needs is `minor`, unless it is flaky or slows the gate measurably

### The testing section

Then read the description's `## Testing` section, the one part of a pull request body this session can falsify. The author cannot see what a sibling branch drove the same day, so the arm list settles the claim rather than the diff.

- Test every unchecked box against the testing discipline in `${CLAUDE_SKILL_DIR}/../git-pr/references/pr.md`, which reserves one for a capability the agent lacks
- Raise a box naming no human, naming a live agent session, or naming a person for a step the repository ships a harness for, such as `canon sandbox run`
- Cost alone is not an answer, since authorizing a spend is the operator's and performing the run is not. A refusal the author met is an answer, naming which.

### Ticked boxes and key changes

Test every ticked box too, bounded to one naming a file or a command. Confirm what it names exists at `<headRefOid>`, through `git show <headRefOid>:<path>` or `git grep <command> <headRefOid>`, rather than re-running it.

- A box naming neither stays untested, since nothing here confirms a claim carrying no artifact
- A box ticked before a later commit removed what it names is a `should-fix` on the body, filed under a `**PR body**` block ahead of the file blocks, since it corrupts the merge record
- Then test `## Key changes` against the diff. Read `${CLAUDE_SKILL_DIR}/references/key-changes.md` for the verb comparing them and which record field becomes a finding.

### Ask rather than grade

Whether a human is genuinely required is a reading the author may hold a reason for, so a Testing question carries no severity and enters no count. It does carry the heading and the dispatch, since a question the author never receives corrects nothing. Answering closes it, and the requirement may hold.

### For the reviewer

Read `## For the reviewer` the same way, bounded to the bullets under that heading. The Summary and Technical context carry the author's argument, and reading them while judging is what an independent pass exists to avoid.

Answer each bullet in the body with no severity and no count.

- An unanswered request stays owed under the heading and dispatch, as an unanswered Testing box does
- An answered one is discharged in the same comment
- A request the diff answers against the author becomes a graded finding under the file that should have handled it, and enters the count, as an unconfirmed Review focus item does

### Review focus

On a first pass, confirm each `**Review focus:**` item the plan names against the diff, since only the planning session's list names the inputs that would break the change. Report them folded under `<details>` after the reviewer block, with the count in its summary as `Review focus, N checked`, one bullet each naming the case and what confirmed it.

- The block carries no severity and enters no count
- An item the pass cannot confirm becomes a `should-fix` finding under the file that should have handled it, so a checked item reads apart from a skipped one
- A plan reading `None identified.`, or a branch with no plan, takes no block
- The section binds the first pass only. A later pass checks the finding an unconfirmed item became, and never re-raises a confirmed item against an untouched delta.

### The filter and the ladder

Apply the high-signal filter: flag only what will cause incorrect behavior, break a documented rule, or mislead a downstream feature. If uncertain, do not flag.

Use severity: `critical` (blocks merge), `should-fix` (fix before merge), `minor` (blocks nothing). The ladder ranks a finding and decides nothing about who acts, since every grade takes the open heading and owes a dispatch.

### A later pass

A later pass applies the same axes to the delta, and adds one check the first cannot make: did each prior finding land, and did the fix regress anything it touched. Its own findings count the same, so a pass raising one is not a close-out at any severity.

A prior finding can also be settled by argument, such as a reply naming the plan question that declined it or a constraint this session could not see. That withdraws the finding or moves its grade.

- State the outcome under the finding it changes, naming the fact that produced it, whether it arrived on the thread or through the dispatch channel
- Dropping it silently leaves a withdrawal indistinguishable from an oversight, and the reasoning leaves with the session that heard it
- A withdrawal leaves the count, so a pass that withdrew every finding is a close-out. Write the withdrawal into the body rather than Step 4's short close-out line, which would credit a fix nobody made.

## Step 4: post to the PR

Read `${CLAUDE_SKILL_DIR}/references/post.md` for the body file name, the body shape, the PR body block, the marker every body carries, and the scans ahead of the post, and `${CLAUDE_SKILL_DIR}/references/body-variants.md` for the Testing and reviewer blocks and the close-out bodies.

That file sends a pass repeating a standing close-out on to `${CLAUDE_SKILL_DIR}/references/close-out.md`, which rewrites the comment in place.

- Stop on a `density` entry in the body scan's record as on any other finding, and regroup or split the item it names before posting
- Read the record rather than the exit, since the scan exits 0 on density alone

## Step 5: output

```plaintext
X critical, Y should-fix, Z minor. Posted to PR #<number>.
```

The counts cover findings alone, so a pass whose only output was a question or an answered request would otherwise report as silent to the session that drove it.

- Add `N Testing question(s) raised.` to that line when the Step 3 check raised any
- Add `N reviewer request(s) answered.` when the PR body carried a `## For the reviewer` section
- Report the merge decision as a plain recommendation in chat (merge, or address findings first). Do not merge.
