---
title: Plan rule ledger
description: Decisions behind governance/rules/canon/plan.md, one row per bullet
---

# Plan rule ledger

The rule is a core rule, so every row is a house choice rather than a citation. Only the guard bullet was decided in the change that wrote this ledger, so the older bullets carry the reason their own text gives, and none carries a date nobody recorded.

## Plan files

| Bullet                           | Source                                                                                                                                                                                                                                                                              | Read       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Load plan-feature before an edit | House choice: the skill's references own a plan's shape and lifecycle, so an edit made without them breaks a section a later reader parses. It beat restating the shape in the rule                                                                                                 | Unknown    |
| Expect plan-guard on a new plan  | House choice: a path-scoped rule loads on a Read, Write, or Edit, and a heredoc is none of them, so the planner writing most plans never saw the bullet above. It beat a reminder, which arrives after the plan is composed, and the rule stays the floor where the hook fails open | 2026-10-28 |
| Never fill an Answer slot        | House choice: a filled slot reads as the owner's decision, so an agent's guess would execute as a settled call. It beat letting the executing session record its pick there                                                                                                         | Unknown    |
| Rewrite an overridden Suggested  | House choice: a deviation left unrecorded makes the plan disagree with the diff, and the blank slot keeps the owner's answer distinct from the override. It beat a note appended below the question                                                                                 | Unknown    |
| Quote the source or mark it      | House choice: a source cited from recall goes stale or never said the line, and nothing downstream rechecks it. It beat trusting a citation's presence                                                                                                                              | Unknown    |
| Archive a shipped plan           | House choice: a deleted plan loses the record a later session reads to learn why the code is shaped as it is. It beat deleting a plan once its branch merged                                                                                                                        | Unknown    |
| Amend in place                   | House choice: a narrated change leaves two passages a reader must reconcile, and the stale one reads as current. It beat an appended changelog section                                                                                                                              | Unknown    |
