---
title: Adopted and declined
description: Which external sources on incremental building this skill adopted, which it declined, and why, so a later session extends the position instead of re-deriving it
---

# Adopted and declined

External sources were read and filtered rather than imported. This file is the record. A later session extending the skill adds to it rather than re-arguing an item already settled here.

## Adopted

### From the default shelf

**Small changes.** [Small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html), from Google's engineering practices: a change should be self-contained and address one thing, a refactor goes in a change apart from the feature that needs it, and a test goes in the same change as the code it covers. Adopted as the rule that each commit carries one logical change, the refactor excuse row, and the rule that a slice's test never lands after its code.

### The increment cycle

**Incremental implementation.** Addy Osmani's `agent-skills`, pinned at addyosmani/agent-skills@2686b620, [`skills/incremental-implementation/SKILL.md`](https://github.com/addyosmani/agent-skills/blob/2686b620/skills/incremental-implementation/SKILL.md). Adopted from it:

- The increment cycle of implement, test, verify, commit, and next slice, with the commit routed through `git-commit` rather than a message format of its own.
- Vertical, risk-first, and contract-first slicing, stated as rules for choosing the next slice rather than as worked examples tied to one stack.
- Rule 1, one thing at a time, as one logical change per commit.
- Rule 2, keep it compilable, as a build left passing at every commit.
- Rule 5, rollback-friendly, as the group on keeping each commit safe to revert and the rule against deleting and replacing in one commit.
- The "noticed but not touching" list from its scope section, routed to the open task's findings or the handover rather than offered as new tasks, since a worker may not add a row to the board.
- The note against re-running a command on unchanged code, scoped to a session's own repeats so it never reads as permission to skip a chain's verify step.
- The rationalizations and red flags that carry across stacks, reworded as reasons this toolkit's sessions give, with one row added for the ship step committing everything anyway.

## Declined

**Rule 0, simplicity first, and the abstraction red flags.** Declined because `code-craft` owns when an abstraction earns its place and when to write the plainest code that passes. Restating it here would put two owners on one rule.

**The rest of its scope section.** Declined as a scope call this skill makes: its slices already keep to the plan, and minimal edits, no unrequested features, and edits limited to what the user named restate that in different words. Only the noticed list was new.

**Rule 3, feature flags for incomplete features.** Declined because the slices of one branch merge together as one pull request rather than reaching trunk one at a time, so nothing incomplete is exposed between them.

**Rule 4, safe defaults.** Declined because a conservative default is a concern of the interface a caller sees, which belongs to the skill shaping that interface rather than to how the work is sequenced.

**The 100-line threshold.** Its red flag of more than 100 lines written without running tests. Declined because a line count means something different on every stack and a session cannot carry it from one to the next. The red flag is stated as a check instead: a slice implemented whose tests have not run.

**Its per-stack command lists and its definition-of-done pointer.** Declined because the project's own `CLAUDE.md` names its verify commands, and a body naming runners stops holding on the next stack.
