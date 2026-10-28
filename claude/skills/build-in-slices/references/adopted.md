---
title: Adopted and declined
description: Which external sources on incremental building this skill adopted, which it declined, and why, so a later session extends the position instead of re-deriving it
---

# Adopted and declined

External sources were read and filtered rather than imported. This file is the record, and a later session extending the skill adds to it rather than re-arguing an item settled here.

A source a bullet rests on is linked once, in that bullet's row of the toolkit's per-bullet ledger at `governance/ledger/skills/build-in-slices/`, which ships outside the plugin. This file names those sources without the link and keeps the catalog-level adopted and declined record, linking only a source no row cites.

## Adopted from the default shelf

### Small changes

Small CLs, from Google's engineering practices, keeps a change self-contained and about one thing, puts a refactor in a change apart from the feature needing it, and puts a test in the same change as its code.

Adopted as the rule that each commit carries one logical change, the refactor excuse row, and the rule that a slice's test never lands after its code.

## Adopted for the increment cycle

Addy Osmani's `agent-skills`, pinned at addyosmani/agent-skills@2686b620, `skills/incremental-implementation/SKILL.md`, supplies the cycle and most of the rules.

### The cycle and its rules

The increment cycle of implement, test, verify, commit, and next slice is adopted with the commit routed through `git-commit` rather than a message format of its own.

- Vertical, risk-first, and contract-first slicing, stated as rules for choosing the next slice rather than as worked examples tied to one stack
- Rule 1, one thing at a time, as one logical change per commit
- Rule 2, keep it compilable, as a build left passing at every commit

### Rollback and the notes

Rule 5, rollback-friendly, is the group on keeping each commit safe to revert and the rule against deleting and replacing in one commit.

- The "noticed but not touching" list from its scope section, routed to the open task's findings or the handover, since a worker may not add a row to the board
- The note against re-running a command on unchanged code, scoped to a session's own repeats so it never reads as permission to skip a chain's verify step
- The rationalizations and red flags that carry across stacks, reworded as this toolkit's sessions give them, plus one row for the ship step committing everything anyway

## Declined

Each item below was read and left out, with the reason it changes nothing a session does here.

### Rules another skill owns

**Rule 0, simplicity first, and the abstraction red flags.** `code-craft` owns when an abstraction earns its place and when to write the plainest code that passes, and restating it here would put two owners on one rule.

**Rule 4, safe defaults.** A conservative default is a concern of the interface a caller sees, which belongs to the skill shaping that interface rather than to how the work is sequenced.

### Rules this skill already covers

**The rest of its scope section.** Its slices already keep to the plan, and minimal edits, no unrequested features, and edits limited to what the user named restate that in different words. Only the noticed list was new.

**Rule 3, feature flags for incomplete features.** The slices of one branch merge together as one pull request rather than reaching trunk one at a time, so nothing incomplete is exposed between them.

### Numbers and commands tied to one stack

**The 100-line threshold.** Its red flag of more than 100 lines written without running tests means something different on every stack. The red flag is stated as a check instead, being a slice implemented whose tests have not run.

**Its per-stack command lists and its definition-of-done pointer.** The project's own `CLAUDE.md` names its verify commands, and a body naming runners stops holding on the next stack.
