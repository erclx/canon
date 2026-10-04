---
title: Body variants for the review comment
description: The Testing and reviewer blocks a pass may carry, and the close-out bodies for a pass carrying nothing, only minors, a withdrawal, or only answered reviewer requests
---

# Body variants

Step 4 of `review-pr`, beside `post.md`. That file names the body file and gives the shape a finding-carrying pass takes, and this one holds the blocks and close-outs that vary it.

A Testing box the Step 3 check raised goes in a `**Testing**` block placed after the file blocks, one bullet per box, each quoting the box and naming what would drive it. It carries no severity and enters no count, and it is still something owed, so a pass carrying one takes `## Review` and the full body rather than either ✅ line. Say so on the summary line as `plus N testing question(s)`, since the three counts read as zero and would otherwise report the pass as silent.

```markdown
**Testing**

- `- [ ] <the box as written>` names no capability the agent lacks. `sandbox/run.sh <arm>` drives it. Was there a reason to leave it?
```

Keep it to the boxes the check raised. Restating a box whose stated requirement holds teaches the branch author to skip the block.

Every `## For the reviewer` bullet Step 3 read goes in a `**For the reviewer**` block placed after the Testing block, one bullet per request, each followed by its answer or, where the pass could not answer it, by what would settle it. It carries no severity and enters no count.

An unanswered bullet is owed the same way an unanswered Testing box is, so a pass carrying one takes `## Review` and the full body rather than either ✅ line. A bullet the pass answered is not owed, since the answer is discharged in the same comment that carries it. A pass still posting a numeric summary line, because a finding, a Testing question, or an unanswered bullet already forces one, says so there as `plus N reviewer request(s)`. The all-answered close-out below carries the block in place of that line and needs no addition to it.

```markdown
**For the reviewer**

- Confirm the 401 and 403 split reads correctly for the public API. Confirmed — `AuthService.authenticate()` returns 401 for an expired token and 403 for a missing scope, and both paths are covered under `## Testing`.
```

A pass carrying nothing at all takes `## Review closed` and a short body, with the footer line included either way. On a first pass, post `✅ No findings. Reviewed against project docs and the board.` On a later pass, post `✅ Prior findings addressed. Re-reviewed <short-sha>, N commits since the prior pass.`

A pass carrying only minors is an ordinary finding-carrying pass, so it takes the open heading and the full shape rather than either short line, since the minors have to be readable and neither line reports them. A pass carrying only Testing questions, or only an unanswered reviewer request, takes the same route for the same reason. Keep whichever scope sentence the pass owes on the summary line:

```markdown
## Review

0 critical, 0 should-fix, Z minor. Reviewed against project docs and the board.

**`path/to/file.ext`**

- **minor** ([line 12](<repo-url>/blob/<headRefOid>/path/to/file.ext#L12)): finding, and the fix it wants.

🤖 Reviewed by Claude Code

<!-- review-pr: commit=<headRefOid> read-at=<read-at> -->
```

A pass that closed by withdrawing a finding rather than by reading its fix takes neither ✅ line, per the withdrawal rule in Step 3. Both claim a fix landed, and the second names it, so posting either over a withdrawal credits work nobody did on the one comment a reader treats as the verdict. Write the withdrawal and the fact that settled it in place of the canned line, keeping the heading and the footer.

A pass whose only content is a `## For the reviewer` block with every bullet answered, and that owes nothing else, takes the same shape: `## Review closed`, the block in place of the canned line, and the footer. The heading reports what the branch author still owes rather than what the pass did, and an answer discharged in the same comment owes nothing back.

Post a close-out even when there is nothing to report. A review left with no closing comment reads as one nobody answered.
