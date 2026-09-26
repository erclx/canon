---
title: Record the number on the task
description: How git-pr writes the pull request number the final command printed onto the task whose Plan line names the branch's plan, and which refusals it skips silently
---

# Record the number on the task

The last step of `git-pr` before its report, reached on every run whose final command printed a number.

Write the `number` the final command printed onto the task the branch is closing. Do not resolve it again. A final command that refused on a head mismatch printed no number, so this step writes nothing on that run. `${CLAUDE_SKILL_DIR}/REQUIREMENT.md` states why: a lookup that resolves by branch alone can return a closed pull request sharing that head, so the number is resolved once and reused rather than re-derived.

The task is the one whose `Plan:` line names the plan this branch implemented. Name that plan by its file, which is `.canon/plans/feature-<slug>.md` at the main worktree root with `<slug>` derived per `${CLAUDE_SKILL_DIR}/../../standards/slug.md`. `plan-feature` writes the plan under the branch slug, so the two correspond on any branch that came through the plan-to-execute path. When the session already knows which plan it implemented, because a caller read it earlier in the chain, use that filename instead of re-deriving.

```bash
canon tasks pull-request <number> --plan feature-<slug> --json
```

The slug is a guess at which plan this branch carries rather than a fact about the task, which is why the verb re-checks it against the board and refuses instead of writing on a near miss. A branch whose slug names no plan file falls to the silent skip below, the same as one whose plan no task cites.

The verb resolves the board at the main worktree root in-process, adds `Pull request: #NNN` under the `Plan:`, `Groundwork:`, `Intake:`, or `Issue:` lines the task already carries, and corrects the number in place when the line exists. This is the route because the write is an edit inside an existing main-root file, which `session-worktree` routes through a verb. That root is the one `session-worktree` resolves on entry.

The correction reaches only a line that does not read as a list of `#NNN` entries. A line that does takes the new number appended rather than replaced, reported as `appended`, so a task shipped in slices keeps every pull request.

The same write drops this branch from the task's `Pending branch:` line, which `canon tasks outcome` wrote when the branch ticked an outcome, so this step is what lets the merge-time archive close the task.

Skip this silently when the record is `ok: false` and `reason` is `no-board`, `no-match`, or `ambiguous`. Those are the three cases a guessed write would compound: no board, no task naming the plan, or more than one. One pull request names one task, and a wrong match archives the wrong task unattended once the branch merges. Report any other refusal rather than swallowing it.

The number is what lets the merge close the task. Every merge on `main` is a squash carrying it in the subject, so the number survives where a branch name does not, and `post-merge` reads it back to call `canon tasks archive`. Writing it here rather than at worktree time is what makes it a pull request number rather than a branch the squash discards.
