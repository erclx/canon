---
title: PHP testing rule ledger
description: Sources for governance/rules/lib/testing-php.md, one row per bullet
---

# PHP testing rule ledger

The field is PHP testing, and the authority is the PHPUnit documentation at docs.phpunit.de with its release announcements at phpunit.de. The manual pages read are the PHPUnit 12.4 edition. Attributes arrived in PHPUnit 10, so the attribute bullet names that floor and a PHPUnit 9 target is never told to use them.

## Layer

| Bullet                  | Source                                                                                              | Read       |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ---------- |
| Load `test-craft` first | House choice: a pointer to the skill that owns the choice of layer, claiming no practice of its own | 2026-10-18 |

## Framework

| Bullet                        | Source                                                                                                                                                                                   | Read                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| PHPUnit as the runner         | House choice: the toolkit's PHP stack configures PHPUnit, so a test written for a second runner never runs in the gate                                                                   | 2026-10-18, PHPUnit 12.4 |
| `final`, extending `TestCase` | [Writing tests](https://docs.phpunit.de/en/12.4/writing-tests-for-phpunit.html): "`GreeterTest` inherits from `PHPUnit\Framework\TestCase`", and every example class is declared `final` | 2026-10-18, PHPUnit 12.4 |

## Attributes

| Bullet                        | Source                                                                                                                                                                                                                                                                       | Read                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Attributes over annotations   | [PHPUnit 12 announcement](https://phpunit.de/announcements/phpunit-12.html): "Support for using annotations has now been removed", and the [PHPUnit 10 announcement](https://phpunit.de/announcements/phpunit-10.html): "PHPUnit 10 introduces support for PHP 8 attributes" | 2026-10-18, PHPUnit 12   |
| `public static` data provider | [Writing tests](https://docs.phpunit.de/en/12.4/writing-tests-for-phpunit.html): "A data provider method must be `public` and `static` and its name must not start with `test`"                                                                                              | 2026-10-18, PHPUnit 12.4 |

## Assertions and doubles

| Bullet                           | Source                                                                                                                                                                                                              | Read                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `assertSame` over `assertEquals` | [Assertions](https://docs.phpunit.de/en/12.4/assertions.html): `assertSame()` fails when the values "do not have the same type and value", while `assertEquals()` compares with `==`                                | 2026-10-18, PHPUnit 12.4 |
| `expectException` first          | [Writing tests](https://docs.phpunit.de/en/12.4/writing-tests-for-phpunit.html): "The `expectException()` method has to be used **before** the exception you expect to be thrown is thrown"                         | 2026-10-18, PHPUnit 12.4 |
| Stub unless asserting a call     | [Test doubles](https://docs.phpunit.de/en/12.4/test-doubles.html): a stub "(optionally) returns configured return values", and a mock "verifies expectations, for instance asserting that a method has been called" | 2026-10-18, PHPUnit 12.4 |
| No real network calls            | House choice: a test reaching the network fails on an outage or a rate limit with no defect in the code under test                                                                                                  | 2026-10-18               |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Cut without a source or a bug class

- Cut "place tests under `tests/`, mirroring the `src/` namespace layout, in files named `*Test.php`" as a layout call, which the `codebase-layout` skill owns. The PHPUnit manual shows the layout in examples and states no rule.

### Merged or reworded

- Prefixed the attribute bullet with "On PHPUnit 10 or later", since attributes do not exist before it.
- Named `public static` in the data provider bullet, the signature the manual requires.
- Reworded the `expectException` bullet to the ordering the manual stresses.
