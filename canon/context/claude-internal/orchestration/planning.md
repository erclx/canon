---
title: Planning
description: The planning dispatch that launches a planner session, what it owes the tracks in flight, why the cross-feature call stays warm, and the gotchas of reading and executing a plan
---

# Planning

## Decisions

### The planning dispatch

`orchestrator-launch.md` carries a second launch shape beside the build one, because dispatching a planner with `claude --bg` needs its boundaries stated once rather than retyped into each launch. Six rules go into the brief.

- No worktree, no branch, no tracked file, no board write, and re-measure rather than trusting the task file
- Report the path alone, a trial condition keeping a blind comparison intact rather than an obligation
- `role-planner` holds all but that one

### Reading what is in flight

Counting worktrees and local branches is unreliable, since this repository squash-merges and leaves both behind. `role-planner` states the read as a command instead, composing the `branch` field of `canon sessions list --json` beside `gh pr list --json number,headRefName`.

A session registers its branch on entering a worktree well before it opens a pull request, so the pull request list alone has nothing to compose against a track still building. Measured at `a2420b4b` on 2026-09-02.

### The build checks do not bind a planner

None of the three checks the build shape runs applies here.

- No candidate branch exists for `canon sessions list --branch` to read
- The conflict check has nothing to compare, since the plan file is gitignored and no track in flight can hold it
- The plan-answer gate has nothing to open, because the planner writes the plan a build would later read, and running it would refuse every planning dispatch

### What a planner owes

A planning dispatch owes the reverse reading. The plan names a constraint per track in flight, so a row planned during a wave is planned against a tree that wave is changing. The role takes that read per task rather than per batch, because a reused session ages its picture of the tree while it works.

### The warm half

The cross-feature call stays in the controlling session. Loop step 1 in `role-orchestrator` keeps which rows conflict, what merges before what, and whether a row should run at all, and lets the per-row measurement go cold to a planner.

Keeping every plan warm was the rejected alternative, on the ground that a warm plan front-loads reasoning a cold worker would re-derive. The planner trials measured finding quality rather than that claim, ten task-file errors across four plans with two controller corrections, so they neither confirm nor retire it.

### The plan is unscanned

The plan is the one artifact nothing scans. `.gitignore` ignores `.canon/plans/` and `canon markdown audit` takes its default paths from what git lists, so no gate opens one.

`plan-feature` Step 4 names that audit call beside the shape validation, since the trials found ban hits in three of four plans that only an unprompted audit caught.

## Gotchas

### A blank answer is a decision nobody took

A blank `Answer:` field is a decision nobody took, and a guard checking only for the plan file admits a plan whose Questions section is entirely unresolved. The shape that works splits the section.

- Ask on the answers that change the diff, change a published surface, or reverse a stated rule, batched into one round
- Take the rest unasked, including any that defer an outward action rather than performing it
- Write every answer back into the plan before implementing, so the file stops reading as unresolved

A suggestion can reverse an explicit instruction on a rendered surface, where adopting it unasked settles that on the author's behalf. One saying "needs your call" can also go unasked until the change it would have settled is already written.

### The numbered questions are coupled

The questions read as independent and are not. A later answer can add a mechanism whose need exists only because of an earlier one, such as a step reporting a rule violation that presupposes the rule is stated in the body it runs from.

After settling every question, re-read the answers as one set and look for a pair where the later answer adds a mechanism the earlier one chose not to supply.

### A narrowed answer leaves its outcome open

A question answered by narrowing scope leaves the board outcome it dropped `[ ]`, so the task stays live and the merge archives no plan. A narrowed answer settles only part of what an outcome asked for.

Where an outcome names a count that does not reproduce against the tree, deliver the substance, cut the outcome, and record the measurement in Findings. A re-measurement can legitimately disagree with the count the outcome was written against.

### A plan's file list decays like a board finding

A plan's `**Files to touch:**` list is a measurement taken when the plan was written, so re-run its count rather than treating it as the scope. A plan can identify which call sites are fixed and still state too low a count for those remaining.

- Re-measure the enumeration before treating the list as complete, and say in the pull request where the sweep went past the plan
- A branch routinely writes paths its plan never declared, mostly because the ship chain writes past the plan. Regenerated surfaces and test and sandbox siblings explain most of it.
- The dispatch gate compares declared sets, so it clears against a prediction. A track can cross a cleared file set without breaking a merge, so `canon tasks plan-reach` reports rather than gates.

### Backticked spans in file entries

Reading every backticked span in a `**Files to touch:**` entry doubles the noise, since a reason can cite a file the entry is not about. A plan can cite one path inside a reason whose subject is a different file being renamed, and its branch never writes the cited path.

`claude/skills/plan-feature/references/plan.md` fixes the colon as the seam, so the parse reads a form the standard states rather than one the verb invented.

### Files to touch can answer an open question early

`## Files to touch` is drafted alongside `## Questions`, so a line there can already write the design a question below it still asks about, with no cross-reference. A renamed field's entry can state one return shape while an unanswered question suggests another, and the Constraints give neither priority.

Where a `- Suggested:` answer conflicts with a Files-to-touch line for the same file, take the suggestion as the more specific and recent decision and adjust the line to match. Report the reconciliation to the reader rather than silently picking a side.
