---
title: Unit and integration tests reference ledger
description: Sources for claude/skills/test-craft/references/unit.md, one row per bullet and ordered step
---

# Unit and integration tests reference ledger

The field is unit testing practice. `addyosmani/agent-skills` and `obra/superpowers`, the two sources the reference cites inline, carry the doubles order, DAMP, and the mutation check. Software Engineering at Google, Fowler, and the Go wiki carry the rest.

The four ordered steps under `## Doubles` and the three under `## The mutation check` each take a row, the way a bullet does.

## Doubles

| Bullet                                   | Source                                                                                                                                                                                                                                      | Read       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Real first                               | [addyosmani/agent-skills, Test-Driven Development](https://github.com/addyosmani/agent-skills/blob/c004a74/skills/test-driven-development/SKILL.md): "1. Real implementation → Highest confidence, catches real bugs"                       | 2026-10-24 |
| Fake second                              | [addyosmani/agent-skills, Test-Driven Development](https://github.com/addyosmani/agent-skills/blob/c004a74/skills/test-driven-development/SKILL.md): "2. Fake → In-memory version of a dependency (e.g., fake DB)"                          | 2026-10-24 |
| Stub third                               | [addyosmani/agent-skills, Test-Driven Development](https://github.com/addyosmani/agent-skills/blob/c004a74/skills/test-driven-development/SKILL.md): "3. Stub → Returns canned data, no behavior"                                           | 2026-10-24 |
| Mock last, when the call is the contract | [Software Engineering at Google, ch. 13](https://abseil.io/resources/swe-book/html/ch13.html): "interaction testing is useful in certain situations but should be avoided when possible because overuse can easily result in brittle tests" | 2026-10-24 |
| Double only at an unowned boundary       | [addyosmani/agent-skills, Test-Driven Development](https://github.com/addyosmani/agent-skills/blob/c004a74/skills/test-driven-development/SKILL.md): "Mock only at boundaries where real deps are slow or non-deterministic"                | 2026-10-24 |
| Never assert a mock exists               | [obra/superpowers, Writing Good Tests](https://github.com/obra/superpowers/blob/5bf4e78/skills/test-driven-development/writing-good-tests.md): "A mock assertion passes when the mock is present and fails when it is absent"               | 2026-10-24 |
| Clock and randomness injected            | [Fowler, Eradicating Non-Determinism in Tests](https://martinfowler.com/articles/nonDeterminism.html): "always wrap the system clock with routines that can be replaced with a seeded value for testing"                                    | 2026-10-24 |

## Descriptive over shared

| Bullet                              | Source                                                                                                                                                                                                                                                     | Read       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| DAMP over DRY                       | [addyosmani/agent-skills, Test-Driven Development](https://github.com/addyosmani/agent-skills/blob/c004a74/skills/test-driven-development/SKILL.md): "each test should tell a complete story without requiring the reader to trace through shared helpers" | 2026-10-24 |
| A factory with the key values shown | [Software Engineering at Google, ch. 12](https://abseil.io/resources/swe-book/html/ch12.html): a test is not complete when "important details are hidden away in helper methods that the reader can’t see"                                                 | 2026-10-24 |
| No shared mutable state             | [Fowler, Eradicating Non-Determinism in Tests](https://martinfowler.com/articles/nonDeterminism.html): "If one test creates some data in the database and leaves it lying around, it can corrupt the run of another test"                                  | 2026-10-24 |

## Table-driven cases

| Bullet                                  | Source                                                                                                                                                                                                                 | Read       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| One table for inputs differing by value | [Go wiki, TableDrivenTests](https://go.dev/wiki/TableDrivenTests): "Each table entry is a complete test case with inputs and expected results, and sometimes with additional information such as a test name"          | 2026-10-24 |
| A row holds input and expected output   | [obra/superpowers, Writing Good Tests](https://github.com/obra/superpowers/blob/5bf4e78/skills/test-driven-development/writing-good-tests.md): "table-driven tests with literal `want` values are the preferred shape" | 2026-10-24 |
| Split the table on a new assertion      | [Go wiki, TableDrivenTests](https://go.dev/wiki/TableDrivenTests): "the actual test simply iterates through all table entries and for each entry performs the necessary tests", one test body every row shares         | 2026-10-24 |

## Integration at a boundary

| Bullet                                 | Source                                                                                                                                                                                                                                      | Read       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Through the callers' interface         | [Vocke, The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html): "Narrow integration tests live at the boundary of your service", "triggering an action that leads to integrating with the outside part" | 2026-10-24 |
| A temporary directory or database each | [Fowler, Eradicating Non-Determinism in Tests](https://martinfowler.com/articles/nonDeterminism.html): tests need "a well-known state at the beginning of the test", and "Properly isolated tests can be run in any sequence."              | 2026-10-24 |
| The failure path at the boundary       | [Software Engineering at Google, ch. 11](https://abseil.io/resources/swe-book/html/ch11.html): a review is easier with "thorough tests that demonstrate code correctness, edge cases, and error conditions"                                 | 2026-10-24 |

## The mutation check

| Bullet                              | Source                                                                                                                                                                                                                                                | Read       |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Name three to five breaks           | [obra/superpowers, Writing Good Tests](https://github.com/obra/superpowers/blob/5bf4e78/skills/test-driven-development/writing-good-tests.md): "mentally mutate the production code", and "at least one test should fail for each realistic mutation" | 2026-10-24 |
| Say which test fails for each       | [Stryker, What is mutation testing?](https://stryker-mutator.io/docs/): "If your tests fail then the mutant is killed", and "If your tests passed, the mutant survived"                                                                               | 2026-10-24 |
| An uncaught break is a missing case | [obra/superpowers, Writing Good Tests](https://github.com/obra/superpowers/blob/5bf4e78/skills/test-driven-development/writing-good-tests.md): "A mutation nothing catches marks the behavior as unprotected"                                         | 2026-10-24 |
