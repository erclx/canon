---
title: Test first skill ledger
description: Sources for claude/skills/test-first/SKILL.md, one row per step and bullet in its concern groups
---

# Test first skill ledger

The field is test-driven development. Kent Beck states the loop, Martin Fowler makes its refactor step mandatory, and `obra/superpowers` carries the failure check the loop runs before writing code. `## What this delegates` routes, so it takes no table.

`references/adopted.md` stays the record of what was adopted and declined at the source level.

## The loop

| Bullet                                  | Source                                                                                                                                                                                                                                                            | Read       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| The test before the code it covers      | [Fowler, TestDrivenDevelopment](https://martinfowler.com/bliki/TestDrivenDevelopment.html): "Write a test for the next bit of functionality you want to add", ahead of "Write the functional code until the test passes"                                          | 2026-10-28 |
| The behavior to come, named as proved   | [obra/superpowers, Test-Driven Development](https://github.com/obra/superpowers/blob/5bf4e78/skills/test-driven-development/SKILL.md): a good test "Demonstrates desired API", and its "Name describes behavior" where `test('test1')` does not                   | 2026-10-28 |
| A failure for the missing behavior      | [obra/superpowers, Test-Driven Development](https://github.com/obra/superpowers/blob/5bf4e78/skills/test-driven-development/SKILL.md): confirm the test "Fails because feature missing (not typos)", and on an error "Fix error, re-run until it fails correctly" | 2026-10-28 |
| The smallest change that passes         | [obra/superpowers, Test-Driven Development](https://github.com/obra/superpowers/blob/5bf4e78/skills/test-driven-development/SKILL.md): "Write simplest code to pass the test", and "Don't add features, refactor other code, or "improve" beyond the test"        | 2026-10-28 |
| The pass it was written for, then suite | [Beck, Canon TDD](https://newsletter.kentbeck.com/p/canon-tdd): "Change the code to make the test (& all previous tests) pass", where "delete assertions so the test pretends to pass" is a mistake                                                               | 2026-10-28 |
| Refactor with the suite green           | [Fowler, TestDrivenDevelopment](https://martinfowler.com/bliki/TestDrivenDevelopment.html): "Refactor both new and old code to make it well structured", since "The most common way that I hear to screw up TDD is neglecting the third step"                     | 2026-10-28 |

## Extending existing behavior

| Bullet                              | Source                                                                                                                                                                                                                                                                       | Read       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A changed assertion fails first     | [obra/superpowers, Test-Driven Development](https://github.com/obra/superpowers/blob/5bf4e78/skills/test-driven-development/SKILL.md) applies the loop "Always" to "Behavior changes", under "If you didn't watch the test fail, you don't know if it tests the right thing" | 2026-10-28 |
| A pass before any change is no test | [obra/superpowers, Test-Driven Development](https://github.com/obra/superpowers/blob/5bf4e78/skills/test-driven-development/SKILL.md): "Test passes? You're testing existing behavior. Fix test."                                                                            | 2026-10-28 |
