---
title: Adopted and declined
description: Which external review patterns this skill adopted, which it declined, and why, so a later session extends the position instead of re-deriving it
---

# Adopted and declined

External sources were read and filtered rather than imported. This file is the record. A later session extending the skill adds to it rather than re-arguing an item already settled here.

A bullet's source is linked in its row of the toolkit's per-bullet ledger at `governance/ledger/skills/review-craft/`, outside the plugin, and this file links only a source no row cites. The `addyosmani/agent-skills` citations below all pin commit `addyosmani/agent-skills@2686b620`.

## Adopted

### Design and scope

**The design procedure.** The nine ordered steps under the design axis draw on four sources, each restated without a language, a framework, or a transport so the walk holds on any stack. Each source below carries the step it backs.

- Ousterhout's deep modules, information hiding, and pass-through methods, [A Philosophy of Software Design](https://web.stanford.edu/~ouster/cgi-bin/book.php)
  - Backs asking what each unit hides, and flagging a unit that passes its arguments straight through
- Parnas's criterion that a boundary hides a decision likely to change, [On the Criteria To Be Used in Decomposing Systems into Modules](https://dl.acm.org/doi/10.1145/361598.361623)
  - Backs the opening step, naming the next likely change and counting what it touches
- Beck's design rules as Fowler records them, especially no duplication and fewest elements, BeckDesignRules
  - Backs the one-place step, and matching each pattern to a problem the code has today
- Google's reviewer guide on design, complexity, and over-engineering, What to look for in a code review
  - Backs the frame for the whole walk, and the reason a speculative abstraction is a finding

The procedure stays in the body rather than a reference, since every review reads the design axis and a reference would cost a read on every run.

### Scope checks

Three scope checks come from outside sources, each adopted as one check.

- **Change sizing as a split.** Google's small CLs and `skills/code-review-and-quality/SKILL.md` ask for one self-contained change, so the check names a split when two concerns could land apart.
- **Relocate versus reduce.** The same `code-review-and-quality` skill counts the concepts a reader holds before and after a refactor, so moved complexity reports as moved.
- **Chesterton's Fence.** `skills/code-simplification/SKILL.md` reads why code exists before removing it, so the check reads `git blame` and the adding commit before calling a path dead.

### Guard the bar

From `skills/constraint-driven-development/SKILL.md`, a change must not pass by weakening the constraint it has to meet. Adopted as its own axis after tests.

- It lists the moved threshold, the skipped or hollowed test, the inline suppression, the excluded path, the throwing stub, the empty catch, and the new config exception
- The clause accepting a suppression whose stated reason holds is this skill's own, since a legitimate one would otherwise report noise the procedures then drop

### Performance

The axis itself, a call inside a loop and an unbounded fetch, comes from `skills/code-review-and-quality/SKILL.md`. Keep or revert comes from `skills/performance-optimization/SKILL.md`.

- Measure before and after the same way, and a neutral result argues for removing the added complexity
- The repeated-run requirement against noise is stated here, so one run on each side reads as an anecdote

### Security additions

From `skills/security-and-hardening/SKILL.md`, the threat model first and the derived-path rule. Both stay stack-neutral, and no red run measures them, so they ship as lifts rather than as an answer to a miss.

- The threat model is the opening step of `references/security.md`, naming who supplies each input and what the code can reach before any class is read
- The derived-path rule is the destructive-operations class, asking for the empty-value collapse, the glob or symlink escape, the missing root check, and no read before the call

### Closing sections

The excuses, red flags, and closing checklist follow the shape every practice skill in this toolkit carries, from [`docs/skill-anatomy.md`](https://github.com/addyosmani/agent-skills/blob/2686b620fc1fed2e8f60c704839c766b8594c6b6/docs/skill-anatomy.md). Each excuse rebuts a reason a review stops at the hunk, such as passing tests against a test the diff skipped.

## Declined

Each item names what was declined and the reason it stays out.

- **Google's approval standard.** "Approve a change once it definitely improves the overall code health" is a grading rule, and grading belongs to the procedures that load this skill.
- **A fixed line count for sizing.** Google's page sets no hard limit, and one concern regularly runs past a hundred lines here, so the split is stated by concern.
- **Named structural remedies as a catalog.** A list of refactorings reads as a menu a session fills in. A design finding states the cost, and the remedy is the author's.
- **STRIDE and abuse-case tests as a procedure.** They belong to a design session, and the threat-model opening takes the one step a diff supports.
- **The web and database tables from `performance-optimization`.** They name a stack, and the axis stays stack-neutral until a target asks for one.

### A dependency upgrade reference

`skills/code-review-and-quality/SKILL.md` reads the changelog across the range, one dependency per change, and the lockfile diff. Declined because the seeded upgrade is not a miss. The body without such a reference reported the planted major bump and the lockfile install script on the second of two runs, passing the assertion.

Revisit when a run on a changed lockfile misses what a reference would have named.
