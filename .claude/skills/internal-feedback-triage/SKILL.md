---
name: internal-feedback-triage
description: Files every open GitHub issue labeled `feedback` on the toolkit repo into an intake folder as one measured item each, skipping any issue the board already carries. Use when asked to "triage toolkit feedback", "work through the feedback issues", "process feedback issues", or "what feedback is open". Do NOT use to file new feedback (that is `canon-feedback`), to answer the filed items (that is `plan-intake-answer`), or to triage issues under another label (that is `canon:issue-triage`).
---

# Internal feedback triage

Consume the feedback queue that `canon feedback` fills. The pass is `issue-triage` run over the `feedback` label, plus the rules below, which hold because a feedback issue describes the project that reported it rather than this one.

- Run from the toolkit repo root
- Read `claude/skills/issue-triage/SKILL.md` from the project root and follow it with the label `feedback`, so the folder is `.canon/intake/<nn>-feedback-triage/`
- Read that body from the tree rather than through the installed plugin, whose cached copy can trail this checkout

## What feedback adds

Apply these during the plugin body's measuring and writing steps.

- Classify each item against the toolkit's own surfaces, being its rules, skills, seeds, verbs, and docs
- Strip the reporting project's filenames, frameworks, deploy targets, and label values from the fix, since it serves every project that installs the toolkit
- Mark the item `not reproduced here` when the repro names another project's paths, per `## Repro versus groundwork` in the intake standard

## Notes

- The `feedback` label is what `canon feedback` and the `toolkit-feedback.yml` issue form both apply.
- This skill files and never reimplements. `issue-triage` owns the pass, `plan-intake-answer` owns the answers, and `task-board` owns the task a plan item becomes.
