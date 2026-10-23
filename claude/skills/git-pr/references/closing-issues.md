---
title: Close the task's issues
description: How git-pr asks canon tasks closes which issues the pull request closes, the Closes line it writes into the body, the refusals it skips silently, and why an earlier slice carries none
---

# Close the task's issues

Reached before the body is written. A task that cites `Issue: #NNN` ships and archives while its issue stays open unless the pull request body carries a closing keyword, and GitHub closes the issue only when that pull request merges into the default branch. `git-pr` always bases on the default branch, so no handling for another base is needed.

## Ask the verb

The plan is the one `task-number.md` names, so reuse the filename an earlier step already read.

```bash
canon tasks closes --plan feature-<slug> --json
```

A branch with no plan runs the verb bare, which finds the task whose plan derives the branch and reports `no-match` when none does:

```bash
canon tasks closes --json
```

The verb reads the current branch itself and counts the names it carried before a rename, so pass nothing else. Branch on the record rather than the exit code.

| Record                                              | Route                                                                              |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `ok: true`, `closing: true`                         | Write one `Closes #NNN` line per number in `issues`, and pass the list to the scan |
| `ok: true`, `closing: false`                        | Write no closing line, and pass `--closes none` to the scan                        |
| `ok: false`, `no-board`, `no-match`, or `ambiguous` | Write nothing and run the scan without `--closes`                                  |
| Any other refusal                                   | Report it rather than swallowing it                                                |

The record also carries `operatorChecks`, the unticked `Operator check:` outcomes. They hold nothing open, so a task with only those left still reads `closing: true`. An operator outcome nobody marked reads as `open-outcomes`, so the mark has to land before `git-pr` runs.

The three skipped refusals are the ones `task-number.md` skips, and for the same reason. A guessed task would close the wrong issue.

## The line

- Put the lines last in `## Summary`, after its sentences, one per issue
- Write `Closes #NNN` with no trailing period, since GitHub reads the keyword and the number and a period adds nothing
- Write one keyword per issue, because GitHub reads a keyword followed by a comma list as closing the first number alone

The scan takes the same list, so a missing line or a closing keyword the verb did not name fails the body:

```bash
canon labels scan --title "<title>" --body-file .canon/tmp/pr/body.md --closes <numbers|none> --json
```

## Why an earlier slice carries none

The verb applies the condition the merge-time archive applies, being no open outcome and no other branch on the task's `Pending branch:` line. The issue then closes exactly when the task archives. An earlier slice merging with a closing keyword would close the issue while later slices are still to ship.

A re-run on an earlier slice's branch reads the same way. The verb looks up the branch's own pull request numbers, and one that is on the task's `Pull request:` line without being last reports `earlier-slice` and no closing line. The lookup runs over REST, and a failed one reports `lookup-failed` and no closing line once the task lists a pull request, since a failure cannot rule an earlier slice out.

`git-ship` ticks the outcomes before `git-pr` runs, so the condition holds at body time. A run with outcomes not yet ticked reads as an earlier slice and writes no line. That is the safe side, since the issue stays open, and the record's `reason` names why.
