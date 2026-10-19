---
title: Body variants for the review comment
description: The Testing and reviewer blocks a pass may carry, and the close-out bodies for a pass carrying nothing, only minors, a withdrawal, or only answered reviewer requests
---

# Body variants

Step 4 of `review-pr`, beside `post.md`. That file names the body file and gives the shape a finding-carrying pass takes, and this one holds the blocks and close-outs that vary it.

## The testing block

A Testing box the Step 3 check raised goes in a `**Testing**` block placed after the file blocks, one bullet per box, each quoting the box and naming what would drive it.

- It carries no severity and enters no count, and it is still owed, so the pass takes `## Review` and the full body rather than either ✅ line
- Say so on the summary line as `plus N testing question(s)`, since the three counts read as zero and would otherwise report a silent pass
- Keep it to the boxes the check raised, since restating a box whose stated requirement holds teaches the author to skip the block

```markdown
**Testing**

- `- [ ] <the box as written>` names no capability the agent lacks. `canon sandbox run <arm>` drives it. Was there a reason to leave it?
```

## The reviewer block

Every `## For the reviewer` bullet Step 3 read gets one bullet in the reviewer block, placed after the Testing block. It carries no severity and enters no count, and a request the pass answered against the author becomes a finding under its file block instead.

- An answered bullet is not owed, since the answer is discharged in the same comment that carries it
- It folds under `<details>` with the count in its summary, as the request shortened and the read or test that settled it
- An unanswered bullet is owed like an unanswered Testing box, so it stays out of the fold in a `**For the reviewer**` block naming what would settle it, and the pass takes `## Review` and the full body
- A pass already posting a numeric summary line adds `plus N reviewer request(s)` to it
- The all-answered close-out below carries the folded block in place of that line and needs no addition

```markdown
<details>
<summary>For the reviewer, N confirmed</summary>

- The 401 and 403 split: `AuthService.authenticate()` returns 401 for an expired token and 403 for a missing scope

</details>
```

## Close-out bodies

A pass carrying nothing at all takes `## Review closed` and a short body, with the footer line included either way. Post a close-out even with nothing to report, since a review left with no closing comment reads as one nobody answered.

- On a first pass, post `✅ No findings. Reviewed against project docs and the board.`
- On a later pass, post the count line, then one line per prior finding, minors included, so a closed review always says what it closed

```markdown
## Review closed

✅ N prior findings addressed at `<short-sha>`. Re-reviewed the N commits since the prior pass.

- **<severity>**, `<path>`: what now holds, in one line

🤖 Reviewed by Claude Code

<!-- review-pr: commit=<headRefOid> read-at=<read-at> -->
```

- Each line names what holds now rather than the commit that fixed it, and stays under 200 characters
- A closing remark that fits no prior finding, such as a ticked Testing box, takes one line of its own after them

### Only minors

A pass carrying only minors is an ordinary finding-carrying pass, so it takes the open heading and the full shape, since neither short line reports the minors. A pass carrying only Testing questions or only an unanswered reviewer request takes the same route. Keep whichever scope sentence the pass owes on the summary line:

```markdown
## Review

0 critical, 0 should-fix, Z minor. Reviewed against project docs and the board.

**`path/to/file.ext`**

- **minor** ([line 12](<repo-url>/blob/<headRefOid>/path/to/file.ext#L12)): what breaks, in one sentence.
  - Fix: the change

🤖 Reviewed by Claude Code

<!-- review-pr: commit=<headRefOid> read-at=<read-at> -->
```

### A withdrawal

A pass that closed by withdrawing a finding rather than reading its fix takes neither ✅ line, per the withdrawal rule in Step 3. Both claim a fix landed, so either credits work nobody did on the comment a reader treats as the verdict.

Write the withdrawal and the fact that settled it in place of the canned line, keeping the heading and the footer.

### Only answered reviewer requests

A pass whose only content is a `## For the reviewer` block with every bullet answered, owing nothing else, takes `## Review closed`, the folded block in place of the canned line, and the footer. The heading reports what the author still owes, and an answer discharged in the same comment owes nothing back.
