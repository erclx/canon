---
title: Plan
description: What the plan reference fixes, the inverted answer contracts, where a deviation is recorded, and how a constraint expires
---

# Plan

## Overview

The plan reference was drafted against a live folder of two or three files, so it was measured against its archive before its shape rules held. It also carries two rules that read as pointing opposite ways, and a constraint block measured against a tree that has moved by the time a worker reads it.

## Layout

- `claude/skills/plan-feature/references/` owns the plan and plan-lifecycle references these decisions explain
- `src/tasks/` owns the plan answer reader and the branch derivation that read a plan back

## Decisions

### Sections

`claude/skills/plan-feature/references/plan.md` fixes the section list and the suggested-and-answer contract. `claude/skills/plan-feature/references/plan-lifecycle.md` fixes the lifecycle from `.canon/plans/` to `.canon/plans/archive/`, and was split out when `plan.md` reached the document ceiling.

- `plan-feature`, `auto-ship`, and `context-fold` each cite the half they read rather than restating it
- The markers are mixed on purpose, `## Summary` as a heading and the other six as bold labels, because that is what the archive writes
- Measure a format claim against the archive, since the live folder holds a handful of files and says nothing about the corpus convention
- The check accepts either spelling and names the table's form in the finding, since a plan carrying `## Risks` has stated its risks and failing it teaches readers to skip the output

### Review focus beside risks

`**Review focus:**` is its own section rather than part of `**Risks:**`, because the two have different readers. A risk is something the executing session plans around. A focus item is an input the finished diff must be shown to handle, which `review-pr` confirms on a first pass.

### The plan rule

`governance/rules/canon/plan.md` routes `.canon/plans/**` and joins `base`. It is hand-written because its standard moved into `plan-feature`, and its one glob covers the archive as well. It loads `canon:plan-feature` for the rest and carries the three directives that ship silently when violated.

- A filled answer slot
- A deleted plan
- A deviation from a suggestion recorded off the plan

### Answer contract

The plan and intake answer contracts invert each other, and both files state the inversion, which is the both-sides rule applied to a contract.

- A blank `- Answer:` accepts the suggestion, because a plan is written and read in one sitting with every question already surfaced
- An empty `You:` means unread, because an intake folder is read over weeks and silence there is far more likely to be absence than assent

The operator-call separator varies in the corpus and the standard fixes only one. `claude/skills/plan-feature/references/plan.md` writes `- Suggested: needs your call, <why>` with a comma, though the corpus also writes a full stop, so `reasonOf` in `src/tasks/answers.ts` strips both.

### Reading the questions section only

The read covers the `Questions` section rather than the file. A plan discussing the operator-call form in its own `Risks` can carry the exact phrase in backticks, so a whole-file match would read that plan as waiting on its own author.

`splitPlanSections` holds the read to the section, the split `checkQuestionContract` already runs, leaving one definition of a question for both readers.

### Execution-time deviations

`claude/skills/plan-feature/references/plan.md` bars filling the answer slot and requires amending the plan in place when a decision changes. The rule carries the pair as two bullets, so the ban could read as covering the whole question block.

The contract says what the ban covers and where a deviation goes.

- It covers the answer line alone, and amending the `- Suggested:` line is the route when an executing session picks other than the suggestion
- The route reaches an unanswered question alone
- A deviation from a filled slot goes back to whoever filled it, because a suggestion rewritten under an answer leaves the plan holding two picks with no default resolving them

### The overridden phrase

The rewritten line opens with the fixed phrase `overridden at execution to <pick>,`, which names the source on a line already being rewritten. Two alternatives lost.

- A fourth marker on the question block lost, since the block already carries three parts and a template growing a line per edge case stops being read
- A trailing measurement as the tell lost, since authors routinely write a number into their own `- Suggested:` line

The deviation also takes one line in the open task's `## Findings`, because the plan is archived at ship and the task is what the board still points at. The plan carries why the pick moved and the task carries what shipped. `claude/skills/task-board/references/tasks.md` names the finding class from its own side.

### Constraint expiry

A constraint block names the file set of every track in flight, and a plan sits in the ready queue until a worker picks it up. A constraint written while a wave is building is correct when written and stale once that wave merges, which can happen before a worker reads it.

The block opens with a stamp bullet reading Measured against `<commit>` on `<YYYY-MM-DD>`, and the standard says a worker re-tests before honoring it. A fetch paired with a log from the stamp to `origin/main`, scoped to the constraint's paths, answers the test in one command.

- The pathspec makes the read decisive, because a squashed merge carries a pull request number in its subject while the constraint names its track by work and file set
- The fetch keeps the test honest, because a stale remote-tracking ref reports fewer merges than have landed and reads a dead constraint as live
- One stamp covers the block however many tracks it names, since a plan is written against the tree once, and its own leading bullet leaves no doubt which constraint the commit applies to

A date alone lost, since two constraints written on the same day can sit on opposite sides of a merge. Naming the tracks in the stamp lost too, since the block already names each track directly below it.

### Why the stamp earns its bullet

A dead constraint fails silently in the expensive direction. A session honoring one ships the dangling citation the change created and reports success, where a session crossing a live constraint collides visibly and is caught.

- An unstamped constraint reads as unverified rather than live, since restamping the queue is a sweep over files a worker may already hold
- Confirming an unstamped one costs that worker the open pull request list
- The rule sits in `plan.md` with `role-orchestrator` naming the stamp alone, because a worker running the planning skill in its own branch writes constraints too
- No check parses the block, so the rule holds by being read

### Sources

Citations sit in an optional `**Sources:**` section rather than inline. A quote does not fit the one-line `- Suggested:` form, and an optional marker leaves a code-only plan untouched, since most plans rest on nothing outside the project.

`source-unquoted` in `src/records/validate.ts` reads the shape of each entry, being a link plus a double-quoted passage or the word `unverified`, and not coverage. No check can tell whether a decision resting on an outside claim got an entry, so the step in `plan-feature` carries that half and the `sourced` sandbox arm measures whether it fires.

- The word `unverified` passes without a quote on purpose, since inventing a quote for a page nobody opened is the failure the section exists to prevent
- An entry owns its nested bullets and wrapped lines, so a passage broken across lines still counts as quoted
- The section closes at the next marker, which `splitPlanSections` does for every section

### Branch description cap

The branch standard's cap reads 2 words as the target with 4 as the ceiling, wide enough that a branch derived from a plan filename is not renamed at ship. A rename there is a third derivation on top of the two `canon tasks plan-branch` exists to collapse.

It also parts the branch slug from the plan slug that `session-worktree` tier 1 and the fallback plan lookup in `git-pr` both read back. Two alternatives lost.

- Tightening `plan.md` to three-word slugs moves the same problem onto roughly a sixth of existing plans, most of them at four words
- Letting the verb flag a non-conforming description leaves `git-branch` renaming a conforming slug anyway

Nothing can tell a plan-derived name from a hand-picked one, so the wider ceiling holds for every branch in every target that installed the standard. The standard says that plainly rather than scoping the sentence to a case no tool can detect.

### Fold rule beside a size floor

A stacked batch that shares most of its files with its parent folds into it, because each pull request pays a fixed cost a same-file slice cannot earn back. On 2026-10-04 the canvas inspector had shipped as five merged pull requests over 26 distinct files, with 25 reviews, 13 comments, and 64 commits, and 29 to 528 minutes from open to merge.

The standard states a fold rule with a written exemption, ``Judged apart from `feature-<parent>`: <reason>``, rather than a minimum slice size. A size floor cannot see a contract split or a taste call the operator judges in its own sitting.

### The stack-foldable check

The check reads declared file sets and the plan's own stack wording, so it measures coupling and not review size. It reports `stack-foldable` at 3 or more shared files, at 60% or more of the smaller set, with 20 files or fewer between the two.

- Over 1,043 live and archived plans, 87 stack pairs name a parent and 15 report, being four chains plus one sandbox contract split that would carry the exemption
- The 20-file ceiling drops one pair of 24 files, which keeps a long chain from folding into one oversized review
- The values are calibrated against that corpus and not derived, since the per-PR overhead was never measured as a number
- The exemption line is fixed text and an empty reason does not clear the finding, so the check reads one pattern and the reason sits where the dispatcher already reads constraints

The sources are DORA's small-batches capability, which names regrouping small batches as a pitfall, and Reinertsen's batch size economics, which frames the optimum as a U-curve with coupling raising the cost of a small batch.

### Shared path beside hold

A constraint on work in flight takes one of two forms, a hold or a shared path, because the dispatch conflict check stopped treating a shared file as a hold. On 2026-10-04 it ran six ready canvas rows one at a time while what they shared was docs paragraphs and appended test cases.

The standard still told a plan to name each track as forbidding an act, and `role-worker` still had a worker concede a file a constraint named as held, so a shared path read as a hold at both ends.

- A shared-path line names the track, the path, and the branch merging second as the one that rebases, and forbids neither act
- The stamp and its re-test apply unchanged, since the line goes stale when the track merges just as a hold does
- The sources are the ones the conflict check cites in `orchestrator-dispatch.md`, being Fowler's branching patterns and Semantic Conflict, DORA's trunk-based development, and GitHub's merge queue

### Contract changes and the length marker

A contract change rides the existing consumer list in `**Risks:**` rather than a new marker. The standard already asked for the list on a resource with more than one consumer, and a new marker would change what `canon records validate plans` parses. The dispatcher reads that bullet for the contract hold.

The standard carries a `canon-length-exempt` marker, since this change took it past the 300-line ceiling. Splitting the constraint forms into a second standard, as `plan-lifecycle.md` was split off, is the follow-up the marker names.
