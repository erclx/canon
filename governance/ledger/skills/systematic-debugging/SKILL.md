---
title: Systematic debugging skill ledger
description: Sources for claude/skills/systematic-debugging/SKILL.md, one row per step and bullet in its concern groups
---

# Systematic debugging skill ledger

The field is software debugging, with reliability engineering for a cause outside the code. Most rows cite the `obra/superpowers` skill this one was ported from, and `addyosmani/agent-skills` adds the non-reproducible tree. Git's docs, Zeller's Debugging Book, and the SRE book cover bisect, reduction, and retry.

The closing sections restate these rules, so they take no table. `references/adopted.md` stays the record of what was adopted and declined at the source level.

## Phase 1: investigate

| Bullet                                     | Source                                                                                                                                                                                                                                                         | Read       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Read every line of the output              | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): "Read stack traces completely", noting "line numbers, file paths, error codes"                    | 2026-10-28 |
| Reproduce, by the likely cause             | [agent-skills](https://github.com/addyosmani/agent-skills/blob/2686b620fc1fed2e8f60c704839c766b8594c6b6/skills/debugging-and-error-recovery/SKILL.md): its non-reproducible tree splits on "Timing-dependent?", "Environment-dependent?", "State-dependent?"   | 2026-10-28 |
| Check what changed, bisecting a regression | [git-bisect](https://git-scm.com/docs/git-bisect): "uses a binary search algorithm to find which commit in your project's history introduced a bug"                                                                                                            | 2026-10-28 |
| Instrument each component boundary         | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): "Run once to gather evidence showing WHERE it breaks", then "investigate that specific component" | 2026-10-28 |
| Trace a bad value to its source            | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): "Keep tracing up until you find the source" and "Fix at source, not at symptom"                   | 2026-10-28 |

## Phase 2: reduce and find the pattern

| Bullet                              | Source                                                                                                                                                                                                                                      | Read       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Reduce to the smallest failing case | [The Debugging Book, Reducing Failure-Inducing Inputs](https://www.debuggingbook.org/html/DeltaDebugger.html): a minimum "not only eases debugging" but explains "why and when the program fails"                                           | 2026-10-28 |
| Compare against working code        | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): "Locate similar working code in same codebase"                                 | 2026-10-28 |
| Read a reference completely         | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): "read reference implementation COMPLETELY", and "Don't skim - read every line" | 2026-10-28 |
| List every difference               | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): "List every difference, however small", and "Don't assume "that can't matter"" | 2026-10-28 |

## Phase 3: hypothesize and test

| Bullet                              | Source                                                                                                                                                                                                                                          | Read       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| State one specific hypothesis       | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): "State clearly: "I think X is the root cause because Y"", "Be specific, not vague" | 2026-10-28 |
| The smallest change, one variable   | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): "Make the SMALLEST possible change to test hypothesis", "One variable at a time"   | 2026-10-28 |
| A new hypothesis, not a stacked fix | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): "Didn't work? Form NEW hypothesis" and "DON'T add more fixes on top"               | 2026-10-28 |
| Say what you do not understand      | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): "Say "I don't understand X"" and "Don't pretend to know"                           | 2026-10-28 |

## Phase 4: fix

| Bullet                             | Source                                                                                                                                                                                                                                            | Read       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A failing test before the fix      | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): the failing test case is one you "MUST have before fixing"                           | 2026-10-28 |
| One change at the root cause       | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): "ONE change at a time", "No "while I'm here" improvements", "No bundled refactoring" | 2026-10-28 |
| The test passes and nothing breaks | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): "Test passes now?" and "No other tests broken?"                                      | 2026-10-28 |

## Three-fix circuit breaker

| Bullet                               | Source                                                                                                                                                                                                                               | Read       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Each fix reveals a new problem       | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): "Each fix reveals new shared state/coupling/problem in different place" | 2026-10-28 |
| Each fix needs refactoring elsewhere | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): "Fixes require "massive refactoring" to implement"                      | 2026-10-28 |
| Symptoms keep moving                 | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): "Each fix creates new symptoms elsewhere"                               | 2026-10-28 |

## When the cause is external or not found

| Bullet                              | Source                                                                                                                                                                                                                                                                  | Read       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Document what was ruled out         | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): for a cause that is "truly environmental, timing-dependent, or external", "Document what you investigated" | 2026-10-28 |
| Log for the next occurrence         | [superpowers, Systematic Debugging](https://github.com/obra/superpowers/blob/8ca22dba9a94f28898bbce59f2537ff4d87c747d/skills/systematic-debugging/SKILL.md): "Add monitoring/logging for future investigation"                                                          | 2026-10-28 |
| Ask whether handling routes around  | [SRE book, Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/): "Serve degraded results by doing less work or dropping unimportant traffic"                                                                                      | 2026-10-28 |
| Ask whether a retry meets the fault | [SRE book, Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/): "the retries themselves may be keeping the backend in an overloaded mode"                                                                                        | 2026-10-28 |
| Count what absorbing costs          | House choice: a retry kept a degraded package mirror on CI's path, and each rerun paid its time and spend. It beat retry by default                                                                                                                                     | 2026-10-28 |
