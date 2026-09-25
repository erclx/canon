---
title: Plan
description: What the plan standard fixes and why its section markers are mixed, the inverted answer contracts, where an execution-time deviation is recorded, how a constraint declares its expiry, and the branch description cap a plan filename feeds
---

# Plan

## Sections

`standards/plan.md` fixes the section list, the suggested-and-answer contract, and the lifecycle from `.canon/plans/` to `.canon/plans/archive/`. `plan-feature`, `auto-ship`, and `docs-fold` each cite the half they read rather than restating it.

The section markers are mixed on purpose, `## Summary` as a heading and the other six as bold labels, because that is what the corpus writes. Across the plan archive, `Summary` is nearly always a heading and never a label, while `Files to touch` and the sections the archive already carried mostly take the bold-label form.

`**Review focus:**` is its own section rather than a part of `**Risks:**`, because the two have different readers. A risk is something the executing session plans around, and a focus item is an input the finished diff must be shown to handle, which `review-pr` confirms on a first pass.

Measure a format claim against the archive rather than the live folder, since the live folder typically holds only a handful of files and says nothing about the corpus convention.

The check accepts either spelling for a section and names the table's form in the finding. A plan carrying `## Risks` has stated its risks, so failing it teaches a reader to skip the output on the rule they are least served by, which is the same failure as a gate whose findings are all whitelisted.

`558-plan` routes `.canon/plans/**` and joins `base`, following `556-groundwork` and `557-intake`. That one glob covers the archive as well. It carries the three directives that ship silently when violated, a filled answer slot, a deleted plan, and a deviation from a suggestion recorded off the plan, and points at the standard for the rest.

## Answer contract

The plan and intake answer contracts invert each other and both files state the inversion, which is the both-sides rule applied to a contract rather than to a scope entry.

A blank `- Answer:` accepts the suggestion because a plan is written and read in one sitting with every question already surfaced, while an empty `You:` means unread because an intake folder is read over weeks and silence there is far more likely to be absence than assent.

The operator-call line's separator varies in the corpus and the standard fixes only one of the two. `standards/plan.md` writes `- Suggested: needs your call, <why>` with a comma, though the corpus also writes it with a full stop, so a reader parsing the phrase strips both. `reasonOf` in `src/tasks/answers.ts` is that reader.

Reading the phrase also means reading the `Questions` section rather than the file. A plan discussing the operator-call form in its own `Risks` can carry the exact phrase in backticks, so a whole-file match would read that plan as waiting on its own author. `splitPlanSections` holds the read to the section, which is the split `checkQuestionContract` already runs, leaving one definition of a question for both readers.

## Execution-time deviations

`standards/plan.md` bars filling the answer slot and requires amending the plan in place when a decision changes. `558-plan` carries the pair under separate headings, so the prohibition could read as covering the whole question block. The contract states that it covers the answer line alone, and that amending the `- Suggested:` line is the route an executing session takes when it picks other than the suggestion.

The route reaches an unanswered question alone. A deviation from a filled slot goes back to whoever filled it, because a suggestion rewritten under an answer leaves the plan holding two picks with no default resolving them.

The rewritten line opens with the fixed phrase `overridden at execution to <pick>,`, which names the source on a line already being rewritten. A fourth marker on the question block lost, since the block already carries a suggestion, an answer slot, and a blank-means-accept default, and a template growing a line per edge case stops being read. A trailing measurement alone lost as the tell, because authors routinely write a number into their own `- Suggested:` line, so a measurement says nothing about who put it there.

The deviation also takes one line in the open task's `## Findings`, because the plan is archived at ship and the task is what the board still points at. The plan carries why the pick moved and the task carries what shipped. `standards/tasks.md` names the finding class from its own side, since a handoff written on one side of a boundary is never checked against the standard on the other.

## Constraint expiry

A constraint block names the file set of every track in flight, and a plan sits in the ready queue until a worker picks it up. A constraint written while a wave is still building is correct when written and stale once that wave merges, which can happen before a worker ever reads it.

The block opens with a stamp bullet reading Measured against `<commit>` on <YYYY-MM-DD>, and the standard says a worker re-tests before honoring it. A fetch paired with a log from the stamp to `origin/main`, scoped to the paths the constraint names, answers the test in one command, which is the bar the stamp had to clear.

- The pathspec makes the read decisive, because a squashed merge carries a pull request number in its subject while the constraint names its track by work and file set.
- The fetch keeps the test honest, because a stale remote-tracking ref reports fewer merges than have landed and reads a dead constraint as live. `task-board` pairs a fetch with a log in one command for the same reason.
- One stamp covers the block however many tracks it names, since a plan is written against the tree once. The stamp takes its own leading bullet, so a two-track block leaves no question about which constraint the commit applies to.

A date alone lost, since two constraints written on the same day can sit on opposite sides of a merge. Naming the tracks in the stamp beside the commit lost too, since the block already names each track directly below it.

An unstamped constraint reads as unverified rather than as live. Restamping the queue is a sweep over files a worker may already hold, and confirming an unstamped one costs that worker the open pull request list.

The rule sits in `standards/plan.md` with `role-orchestrator` naming the stamp alone, because a worker running the planning skill in its own branch writes constraints too. No check parses the block, so the rule holds by being read.

## Branch description cap

The branch standard's cap reads 2 words as the target with 4 as the ceiling, wide enough that a branch derived from a plan filename is not renamed at ship. A rename there is a third derivation on top of the two `canon tasks plan-branch` exists to collapse, and it parts the branch slug from the plan slug that `session-worktree` tier 1 and `git-pr`'s fallback plan lookup both read back to find the plan.

Two alternatives lost. Tightening `standards/plan.md` to three-word slugs moves the same problem onto roughly a sixth of existing plans, most of them at four words. Changing neither and letting the verb flag a non-conforming description leaves `git-branch` renaming a conforming slug anyway.

Nothing can tell a plan-derived name from a hand-picked one, so the wider ceiling holds for every branch in every target that installed the standard. The standard says that plainly rather than scoping the sentence to a case no tool can detect.
