---
name: internal-feedback-triage
description: Why the toolkit's feedback queue runs through the generic issue triage with its own rules on top, rather than through a copy of that pass
---

# Internal feedback triage requirement

## Gap

Without this skill, the feedback queue fills and nothing drains it. `issue-triage` drains any repository's queue, but a feedback issue describes the project that reported it, so its fix measured as-is serves that one project and its repro points at paths this tree lacks.

A second copy of the triage pass would drift from the plugin skill, so the toolkit's queue needs the shared pass plus the rules that make a report from elsewhere fit this tree.

## Must

- Run the `issue-triage` pass over the `feedback` label, read from this checkout rather than from the installed plugin
- Strip the reporting project's specifics from each fix, so it serves every project that installs the toolkit
- Classify each item against the toolkit's own surfaces

## Must not

- Restate a step `issue-triage` owns, since the copy would drift
- Post to the remote, whether a comment, a close, or a label

## Out of scope

- Filing new feedback, which `canon-feedback` owns
- Triaging issues under any other label, which `canon:issue-triage` owns
- Answering the filed items, which `plan-intake-answer` owns
