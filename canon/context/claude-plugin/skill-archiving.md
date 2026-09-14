---
title: Skill archiving on merge
description: The post-merge hook that closes a shipped task, how a pull request number reaches the board, and where the archive gates live
---

# Skill archiving on merge

Which task closes is decided from the diff, not the session. `docs-fold` resolves a merge base against `origin/main`, unions the committed diff with the working tree and untracked files, then matches unchecked outcomes on the board against what shipped. Completion is a fact about the repository, so a session that shipped a queued task without ever discussing it still leaves the board correct.

Requirements, architecture, and design stay session-sourced, because those are judgments a diff cannot carry. The same baseline feeds the wireframe sweep and the context refresh, which previously read `git diff main` and saw nothing at all when run on `main` itself. See `canon/context/claude-plugin/skill-baseline.md` for how that baseline resolves and which skills share it.

Nothing chained the archive until the `post-merge` git hook landed. Every earlier step fires from `auto-ship` or `git-ship`, both of which finish while the pull request is still open, and a task archived there closes for work that may be abandoned. So the hook is the only event that lands late enough, and the board being gitignored rules out reading it from anywhere but the operator's own machine.

That hook archives rather than announcing, and the escalation turned on closing one gap rather than on the detection proving itself. Both reasons the announce-only design gave for declining to act were re-measured. The first, that `index.md` regenerates from a `PostToolUse` hook a shell-side `mv` never fires, was void: `canon indexes regen` is a CLI verb, so the command regenerates the index as part of the move. The second, that a gitignored board leaves no diff to review with nobody watching, holds only for a blind sweep of every all-`[x]` task and stops holding once the hook can name which task a merge closed.

## Naming the pull request a merge closed

Naming it is what nothing recorded. A branch name cannot carry the link, because every merge on `main` is a squash with a single parent and the branch commits never land, so an ancestry test fails on every shipped task. The number in the subject is the only offline signal.

`git-pr` writes `Pull request: #NNN` onto the task from the number its final command printed, which is the one step that always runs when a pull request opens, and the hook reads it back out of `ORIG_HEAD..HEAD`. Reading the tip alone would strand every task but the last on a pull that fast-forwards over several merges.

That number has to name an open pull request. `gh pr view` resolves by head branch and ignores state, so a branch name reused after an earlier pull request merged returned the closed one, and the run rewrote a merged pull request's title and body while reporting its URL as the one it opened. The detection reads `gh pr list --head` scoped to `--state open` and to the repository's default base now, since one head can carry open pull requests against two bases and reading the first result would pick between them by list order. The run resolves once and reuses what that command printed rather than looking the number up again for the task write.

`git-followup` needed nothing, since its guard already stops unless the state is `OPEN`. The cause sits in `git-branch`, which has no collision check against a name that already carried a pull request, and that stays on the board because scoping the lookup makes a reused name survivable.

## Where the gates live

The gates all live in `canon tasks archive` rather than in the shell. A hook that pre-filtered would duplicate them in a language where the outcome test already needed an errexit comment, and the skill calling the same command is what stops the attended and unattended paths archiving differently.

Each gate refuses with a non-zero exit rather than reporting, since a caller with nobody watching cannot act on a warning. A task whose outcomes are not all closed, whose plan is still live, or which shares its pull request number with another task all refuse and print why. `task-board` keeps the one check the command cannot make, which is confirming the work reached `main` when a person archives by name rather than by merge.

`post-rewrite` carries the same check for anyone pulling with rebase. `git pull` under `pull.rebase=true` runs `git rebase`, which fires that event and never `post-merge`, so without it the trigger is a silent no-op on that machine. It delegates to `post-merge` on the `rebase` argument alone, since the same event fires on `commit --amend` and an amend changes nothing on the board. Silence is the wrong failure mode for a hook that exists to stop a shipped task being forgotten, and the base stack ships to targets whose pull style this repository does not control.
