---
title: Memory review receipt format
description: The proposal file structure, its item template, and how each action type varies the body
---

# Memory review receipt format

The shape Step 4 of the Propose phase writes to `.canon/review/memory/memory-review-<slug>.md`. Only Propose writes this file. Challenge, Discuss, and Apply rewrite items inside a receipt that already exists, and Cleanup deletes one, so none of the four needs this file.

## Structure

A summary block at the top, a legend, then one H2 per numbered item. Number items across all actions so the user can reference them by number. Fuse the status, action, and target into each H2. Put the memory filename on its own line, a one-line Why, the rewritten rule inline in a fenced `diff` block prefixed with `+` so reviewers see the additions in green, and a `Decision:` slot for the user.

Do not include a `Take:` slot in the template. Discuss inserts one directly under `Decision:` only when responding to a question item. Status starts as 📝 pending for every item at proposal time.

````plaintext
# Memory review: <slug>

**Pending:** <all numbers>

Legend: ✅ applied · ⏭ skipped · 📦 retired · 🤝 handed off · 📝 pending

How to respond: fill in `Decision:` per item (`apply`, `skip`, `defer`, or a question with `?`), then re-ping the skill. Say "discuss" for question rounds, "apply" to commit. Chat shortcut: `all`, `none`, or a list of numbers.

## 1. 📝 Promote → `<target>`

`<memory-file>`

Why: <one-line pulled from the memory's Why>

```diff
+ <rewritten rule text>
```

Decision:

## 2. 📝 Retire

`<memory-file>`

Reason: <one-line reason>

Decision:
````

## Variation by action

For Hand off items, the body is a pointer to the governance target instead of a rewritten rule: `internal-governance` and `${CLAUDE_SKILL_DIR}/../../standards/rule.md` in the toolkit repo, or the `create-rule` skill in a target project. For a Promote to an always-loaded rule item, the H2 target names the rule file path the rule lands in, `<target>` in the template above, being an existing path under `internal/rules/core/` or `governance/rules/core/` in the toolkit repo, or under `.claude/rules/project/` in a target project, or the `create-rule` pointer when no existing file fits. For Retire items, skip the rewrite block. Every item gets a `Decision:` slot regardless of action. `Take:` is added only when a question response is needed.
