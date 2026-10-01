---
title: Adopted and declined
description: Which external review patterns this skill adopted, which it declined, and why, so a later session extends the position instead of re-deriving it
---

# Adopted and declined

External sources were read and filtered rather than imported. This file is the record. A later session extending the skill adds to it rather than re-arguing an item already settled here.

## Adopted

### Design and scope

**The design procedure.** The nine ordered steps under the design axis draw on four sources, each restated without a language, a framework, or a transport so the walk holds on any stack.

- Ousterhout's deep modules, information hiding, and pass-through methods ([A Philosophy of Software Design](https://web.stanford.edu/~ouster/cgi-bin/book.php)): the step asking what each unit hides and flagging a unit that passes its arguments straight through.
- Parnas's criterion that a module boundary hides a decision likely to change ([On the Criteria To Be Used in Decomposing Systems into Modules](https://dl.acm.org/doi/10.1145/361598.361623)): the opening step naming the next likely change and counting what it touches.
- Beck's design rules as Fowler records them, especially no duplication and fewest elements ([BeckDesignRules](https://martinfowler.com/bliki/BeckDesignRules.html)): the one-place step and the step matching each pattern to a problem the code has today.
- Google's reviewer guide on design, complexity, and over-engineering ([What to look for in a code review](https://google.github.io/eng-practices/review/reviewer/looking-for.html)): the frame for the whole walk, and the reason a speculative abstraction is a finding.

The procedure stays in the body rather than a reference, since every review reads the design axis and a reference would cost a read on every run.

**Change sizing as a split.** Google's [small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html) asks for one self-contained change. Adopted as the scope check that names a split when two concerns could merge apart, and from `addyosmani/agent-skills@2686b620`, `skills/code-review-and-quality/SKILL.md`, alongside it.

**Relocate versus reduce.** From the same `code-review-and-quality` skill: a refactor counts the concepts a reader must hold before and after. Adopted as the scope check that reports moved complexity as moved.

**Chesterton's Fence.** From `addyosmani/agent-skills@2686b620`, `skills/code-simplification/SKILL.md`: read why code exists before removing it. Adopted as the scope check that reads `git blame` and the commit that added a removed path before calling it dead.

### Guard the bar

From `addyosmani/agent-skills@2686b620`, `skills/constraint-driven-development/SKILL.md`: a change must not pass by weakening the constraint it has to meet. Adopted as its own axis after tests, listing the moved threshold, the skipped or hollowed test, the inline suppression, the excluded path, the throwing stub, the empty catch, and the new config exception. The clause accepting a suppression whose stated reason holds is this skill's own, since a legitimate suppression with its reason beside it would otherwise report noise the procedures' filter then drops.

### Performance

From `addyosmani/agent-skills@2686b620`, `skills/code-review-and-quality/SKILL.md` for the axis itself, a call inside a loop and an unbounded fetch, and `skills/performance-optimization/SKILL.md` for keep or revert: measure before and after the same way, and a neutral result argues for removing the added complexity. The repeated-run requirement against noise is stated here so one run on each side reads as an anecdote.

### Closing sections

The excuses, red flags, and closing checklist follow the practice skill shape every practice skill in this toolkit carries, taken from `addyosmani/agent-skills@2686b620`, [`docs/skill-anatomy.md`](https://github.com/addyosmani/agent-skills/blob/2686b620fc1fed2e8f60c704839c766b8594c6b6/docs/skill-anatomy.md). Each excuse row rebuts a reason a review stops at the hunk, such as passing tests against a test the diff skipped, rather than an objection nobody raised.

## Declined

**Google's approval standard.** "Approve a change once it definitely improves the overall code health" is a grading rule. Grading and posting belong to the procedures that load this skill, which each own a severity ladder, so the standard stays out of the body.

**A fixed line count for sizing.** Google's small-CL page sets no hard limit, and one concern regularly runs past a hundred lines here. A number would fire on nearly every branch, so the split is stated by concern instead.

**Named structural remedies as a catalog.** A list of refactorings to propose reads as a menu a session fills in. A design finding states the cost, and the remedy is the author's.

**The web and database tables from `performance-optimization`.** They name a stack, and the axis stays stack-neutral until a target asks for a per-stack reference.
