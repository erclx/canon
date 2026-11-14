---
title: Comments reference ledger
description: Sources for claude/skills/code-craft/references/comments.md, one row per bullet
---

# Comments reference ledger

The field is software engineering practice for source comments, which has no spec. The Linux kernel coding style carries placement, and Google's C++ guide carries what a comment says. Both are practice from one large codebase rather than a settlement of the field, and the limits are house choices the scan enforces.

## What a comment says

| Bullet                           | Source                                                                                                                                                                                                                     | Read       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A contract, a constraint, or why | [Google C++ Style Guide](https://google.github.io/styleguide/cppguide.html): "Instead, provide higher-level comments that describe why the code does what it does, or make the code self-describing."                      | 2026-11-14 |
| No step-by-step walk through     | [Linux kernel coding style](https://www.kernel.org/doc/Documentation/process/coding-style.rst): "NEVER try to explain HOW your code works in a comment: it's much better to write the code so that the working is obvious" | 2026-11-14 |

## Where it sits

| Bullet                       | Source                                                                                                                                                                                                                                           | Read       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| The reason at the head       | [Linux kernel coding style](https://www.kernel.org/doc/Documentation/process/coding-style.rst): "put the comments at the head of the function, telling people what it does, and possibly WHY it does it"                                         | 2026-11-14 |
| A body note of a line or two | [Linux kernel coding style](https://www.kernel.org/doc/Documentation/process/coding-style.rst): "try to avoid putting comments inside a function body", though "You can make small comments to note or warn about something particularly clever" | 2026-11-14 |

## What it leaves out

| Bullet                            | Source                                                                                                                                                                                           | Read       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| History to the pull request       | House choice: a measured date, a commit, or an issue number is true only of the moment it was written, and the pull request keeps it beside the diff it explains, where no later edit strands it | 2026-11-14 |
| A placeholder for an example date | House choice: the scan matches a date and an issue number as patterns, and no width rule tells a six-digit color from a pull request number, so a placeholder or a token name keeps the contract | 2026-11-14 |
| Past three lines of text, cut     | House choice: three lines of text inside two delimiters is the longest head block the scan reads as clean, so a longer one is where a cut pays first                                             | 2026-11-14 |

## The limits

| Bullet                   | Source                                                                                                                                     | Read       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| The limits from the scan | House choice: the gate reads its figures from the scan, so stating them here would be a second copy that drifts the first time a cap moves | 2026-11-14 |
