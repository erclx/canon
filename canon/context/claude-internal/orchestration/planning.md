---
title: Planning
description: The planning dispatch that launches a planner session, what it owes the tracks in flight, why the cross-feature call stays warm, and the gotchas of reading and executing a plan
---

# Planning

## The planning dispatch

`orchestrator-launch.md` carries a second launch shape beside the build one, for the same reason as the first: dispatching a planner with `claude --bg` needs its boundaries stated once rather than retyped into each launch. Six rules go into the brief: no worktree, no branch, no tracked file, no board write, report the path alone, and re-measure rather than trusting the task file. `role-planner` holds all but the fifth, report the path alone, which is a trial condition keeping a blind comparison intact rather than an obligation.

Counting worktrees and local branches for what is in flight is unreliable, since this repository squash-merges and leaves both behind after a merge: a branch is not evidence and neither is a worktree. `role-planner` states the read as a command instead, composing `canon sessions list --json`'s own `branch` field beside `gh pr list --json number,headRefName`, since a session registers its branch on entering a worktree well before it opens a pull request, and the pull request list alone has nothing to compose against a track still building with nothing pushed. Measured at `a2420b4b` on 2026-09-02.

None of the three checks the build shape runs binds this one. No candidate branch exists for `canon sessions list --branch` to read, and the disjointness gate has nothing to compare, since the plan file is gitignored and no track in flight can hold it. The plan-answer gate has nothing to open, because the planner is dispatched to write the plan a build would later read, so running it here refuses every planning dispatch over a file nobody has authored.

A planning dispatch owes the reverse reading. The plan it produces names a constraint per track in flight, so a row planned during a wave is planned against a tree that wave is changing, and the role takes that read per task rather than per batch because a reused session ages its picture of the tree while it works.

### The warm half

The cross-feature call stays in the controlling session. Loop step 1 in `role-orchestrator` keeps which rows collide, what merges before what, and whether a row should run at all where the board is readable in full, and lets the per-row measurement go cold to a planner. Keeping every plan warm was the alternative, on the ground that a warm plan front-loads reasoning a cold worker would otherwise re-derive. The planner trials measured finding quality rather than that claim, ten task-file errors across four plans with two controller corrections, so they neither confirm nor retire it, and the narrowed step claims no more than they measured.

The plan is also the one artifact nothing scans. `.gitignore` ignores `.canon/plans/` and `canon markdown audit` takes its default path set from what git lists, so no gate opens one. `plan-feature` Step 4 names that audit call beside the shape validation, since the trials found ban hits in three of four plans that only an unprompted audit caught.

## Gotchas

### A blank answer is a decision nobody took

A blank `Answer:` field is not a decision anyone took, and a pipeline guard that checks only for the plan file admits a plan whose Questions section is entirely unresolved. The shape that works splits the section rather than taking it whole: ask on the answers that change what the diff contains, change a published surface, or reverse a stated rule, batch those into one round, and take the rest unasked, including any that defer an outward action rather than performing it.

A suggestion can reverse an explicit instruction on a rendered surface, where adopting it unasked settles that on the author's behalf, and a suggestion carrying words like "needs your call" can go unasked until the change it would have settled is already written. Write every answer back into the plan before implementing, so the file stops reading as unresolved.

### The numbered questions are coupled

The numbered questions are presented as independent and are not: a later answer can add a mechanism whose need only exists because of an earlier answer, such as a step reporting a rule violation that presupposes the rule is stated in the body it runs from rather than only referenced. After settling every question, re-read the answers as one set and look for a pair where the later answer adds a mechanism the earlier answer chose not to supply.

### A narrowed answer leaves its outcome open

A question answered by narrowing scope leaves the board outcome it dropped still `[ ]`, so the task stays live and `docs-fold` archives no plan, since a narrowed answer can settle only part of what an outcome asked for. Where an outcome instead names a count that does not reproduce against the tree, deliver the substance, cut the outcome, and record the measurement in Findings, rather than leaving the box open or checking it against a number that was never there: a re-measurement can legitimately disagree with the count the outcome was written against.

### A plan's file list decays the way a board finding does

A plan's `**Files to touch:**` list is a measurement taken when the plan was written, and its count is worth re-running rather than treating as the scope. A plan can correctly identify which of several similar call sites are already fixed while still stating too low a count for how many remain, since a full sweep across `src/` can turn up call sites the plan's own enumeration missed. Re-measure the enumeration before treating the list as complete, and say in the pull request where the sweep went past the plan.

The decay is the ordinary case rather than the exception: a branch routinely writes paths its own plan never declared, mostly because the ship chain writes past the plan rather than because a session widened scope. Surfaces `bun run check` regenerates and asserts drift on, plus the test and sandbox siblings a source change drags in, account for most of the gap. The cost lands on the dispatch gate, which compares declared sets and therefore clears against a prediction: a track can cross a file set it had cleared against without breaking a merge, which is why `canon tasks plan-reach` reports rather than gates.

Reading every backticked span in a `**Files to touch:**` entry doubles the noise, since a reason can cite a file the entry is not about, which is a form the standard invites: a plan can cite one path inside a reason whose subject is a different file being renamed, and its branch never writes the cited path. `standards/plan.md` fixes the colon as the seam, so the parse reads a form the standard states rather than one the verb invented.

### Files to touch can answer an open question early

`## Files to touch` is drafted alongside `## Questions` rather than after it, so a Files-to-touch line can already write the design a question below it is still asking about, with no cross-reference between the two. A renamed field's entry can state one return shape while an unanswered question suggests another, with nothing in the Constraints giving either priority. Where a `- Suggested:` answer conflicts with a Files-to-touch line for the same file, take the suggestion as the more specific, more recently considered decision and adjust the conflicting line to match, then report the reconciliation to the reader rather than silently picking a side.
