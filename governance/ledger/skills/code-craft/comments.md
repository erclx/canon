---
title: Comments reference ledger
description: Sources for claude/skills/code-craft/references/comments.md, one row per bullet
---

# Comments reference ledger

The field is software engineering practice for source comments, which has no spec. The Linux kernel coding style carries placement, and Google's C++ guide carries what a comment says. Both are practice from one large codebase rather than a settlement of the field, and the limits are house choices the scan enforces.

## What a comment says

| Bullet                           | Source                                                                                                                                                                                                                        | Read       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A contract, a constraint, or why | [Google C++ Style Guide](https://google.github.io/styleguide/cppguide.html): "Instead, provide higher-level comments that describe why the code does what it does, or make the code self-describing."                         | 2026-11-14 |
| A reason, not a description      | House choice: a fifth of sampled head comments restated the name they sat on, and a description the name and type carry goes stale with no check to catch it. It beat banning internal comments, which drops the reasons too. | 2026-11-17 |
| No step-by-step walk through     | [Linux kernel coding style](https://www.kernel.org/doc/Documentation/process/coding-style.rst): "NEVER try to explain HOW your code works in a comment: it's much better to write the code so that the working is obvious"    | 2026-11-14 |

## Where it sits

| Bullet                  | Source                                                                                                                                                                                                                                                                                                                                          | Read       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| The reason at the head  | [Linux kernel coding style](https://www.kernel.org/doc/Documentation/process/coding-style.rst): "put the comments at the head of the function, telling people what it does, and possibly WHY it does it"                                                                                                                                        | 2026-11-14 |
| A body note of one line | [Linux kernel coding style](https://www.kernel.org/doc/Documentation/process/coding-style.rst): "try to avoid putting comments inside a function body", though "You can make small comments to note or warn about something particularly clever". One line is the house cap, since a cap of 2 changed nothing when most notes already sat at 2. | 2026-11-17 |

## What it leaves out

| Bullet                            | Source                                                                                                                                                                                           | Read       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| History to the pull request       | House choice: a measured date, a commit, or an issue number is true only of the moment it was written, and the pull request keeps it beside the diff it explains, where no later edit strands it | 2026-11-14 |
| A placeholder for an example date | House choice: the scan matches a date and an issue number as patterns, and no width rule tells a six-digit color from a pull request number, so a placeholder or a token name keeps the contract | 2026-11-14 |
| A head block of three text lines  | House choice: three text lines held the contracts that carry two separate facts, which a cap of 1 or 2 cut in about 1 run in 15, and the gate fails a fourth line                                | 2026-11-17 |

## The limits

| Bullet                   | Source                                                                                                                                     | Read       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| The limits from the scan | House choice: the gate reads its figures from the scan, so stating them here would be a second copy that drifts the first time a cap moves | 2026-11-14 |
