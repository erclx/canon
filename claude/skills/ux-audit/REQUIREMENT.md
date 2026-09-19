---
name: ux-audit
description: Why UI roughness is reported against stated intent rather than taste, and why the audit observes without fixing
---

# UX audit requirement

## Gap

Without this skill, UI roughness is found by users. An audit that does run reports personal taste, because nothing anchors it to what the project intended, so the findings are arguable and get argued rather than fixed. It flags work the board already marks in progress, which spends the reader's attention on a surface nobody claimed was finished.

The pass slides into fixing what it finds, and then the audit and the change land together with no record of which observation drove which edit, so neither can be reviewed. Reported into chat, the whole thing evaporates before anyone acts on it, and the next audit rediscovers the same list.

## Must

- Read the design system and the per-surface wireframes as ground truth for intent before flagging any drift
- Group findings by surface, since a surface is what a person opens and fixes
- Cover missing feedback states, unhandled edge cases, inconsistencies, and friction in daily use
- Write the full report to the branch-derived path at the main worktree root, overwriting
- Report no observations rather than filling the list to show work

## Must not

- Suggest an implementation or change any code
- Flag a surface the task board marks in progress
- Report a preference no stated intent supports
- Repeat the full report in chat, which is what loses it
- Stage or commit the report, which is gitignored scratch

## Guards

- No UI surfaces in the project: stop, since there is nothing to audit

## Out of scope

- Fixing what it found, which is a separate change with its own review
- Feature planning, which `plan-feature` owns
- Verifying one specific change, which `ui-checklist` owns
- Defining the intent it audits against, which `design-extract` and the wireframes own
- Measuring what a running interface costs to paint, block, or shift, which `ux-measure` owns. Contrast stays here rather than going with it, being computable from two color values this skill already reads off the token table.
