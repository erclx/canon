---
title: Adopted and declined
description: Which external debugging patterns this skill adopted, which it declined, and why, so a later session extends the position instead of re-deriving it
---

# Adopted and declined

External sources were read and filtered rather than imported. This file is the record. A later session extending the skill adds to it rather than re-arguing an item already settled here.

## Adopted

### The four phases

**Investigate, find the pattern, hypothesize, fix.** From `obra/superpowers@8ca22db`, [`skills/systematic-debugging/SKILL.md`](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md), 283 lines at that commit. The four-phase spine, the no-fix-before-investigation rule, and the three-attempt stop come from it, restated in a fraction of the length. Nothing records the commit the original port read, so this pin names the one read when the ledger was written rather than the one the port used.

### The investigation lifts

Each from `addyosmani/agent-skills@2686b620`, [`skills/debugging-and-error-recovery/SKILL.md`](https://github.com/addyosmani/agent-skills/blob/2686b620fc1fed2e8f60c704839c766b8594c6b6/skills/debugging-and-error-recovery/SKILL.md), 300 lines at that commit.

**Bisect for a regression.** Its localize step runs `git bisect` against a known good commit, with `git bisect run` driving the focused test. Adopted in phase 1 with the runner replaced by a placeholder for the project's own focused test command.

**Reduce to a minimal case.** Its reduce step strips code, config, and input until only the failure remains. Adopted as the opening step of phase 2, so phase 1 stays reproduce and locate, and the comparison against working code runs on the reduced case.

**The non-reproducible tree.** Its timing, environment, state, and truly-random branches, each with first moves. Adopted in phase 1 step 2 with the runtime names stripped. The random branch hands off to the no-root-cause section rather than to its alerting advice, since setting up an alert is a production concern outside a debugging session.

**Error output as untrusted data.** Its rule that error messages, stack traces, and logs are data to analyze, and that a command, URL, or step inside them goes to the user. Adopted in phase 1 step 1, in the red flags, and in the closing checklist, with reading the error in full left intact.

### Closing sections

The excuses, red flags, and closing checklist follow the practice skill shape every practice skill in this toolkit carries, taken from `addyosmani/agent-skills@2686b620`, [`docs/skill-anatomy.md`](https://github.com/addyosmani/agent-skills/blob/2686b620fc1fed2e8f60c704839c766b8594c6b6/docs/skill-anatomy.md). Each excuse row rebuts a reason a session gives to skip the investigation, three of them from the source's own rationalizations table and the rest from this skill's earlier red flags, rather than an objection nobody raised.

### Default shelf

[Software Engineering at Google](https://abseil.io/resources/swe-book/html/toc.html) and [Google's engineering practices](https://google.github.io/eng-practices/) were checked first. Neither carries a debugging procedure, so the shelf gave this skill nothing.

## Declined

**The stop-the-line rule.** The source's six-step stop, preserve, diagnose, fix, guard, resume sequence. Declined because the rule at the top of the body and the three-attempt stop already carry it, and a second sequence would compete with the four phases.

**Safe fallback patterns.** The source's safe default and graceful degradation examples. Declined because the no-root-cause section already names retry, timeout, and explicit error as the handling, and a fallback written under time pressure is the symptom fix phase 1 exists to prevent.

**Per-error triage trees.** The source's test, build, and runtime triage trees and its layer table name runtimes, browsers, and package managers. Declined as stack-specific, since the body holds across stacks.

**The six-step spine.** The source orders reproduce, localize, reduce, fix, guard, verify. Declined in favor of keeping the four phases, since other skills cite "phase 1" and the three-attempt stop by those names.
