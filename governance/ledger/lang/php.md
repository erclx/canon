---
title: PHP rule ledger
description: Sources for governance/rules/lang/php.md, one row per bullet
---

# PHP rule ledger

The field is PHP programming, and the authority is the PHP manual at php.net, with the PHP Framework Interop Group's standards at php-fig.org for autoloading and file layout. The manual pages read belong to the PHP 8.5 manual.

## Strictness

| Bullet                      | Source                                                                                                                                                                                                                                             | Read                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `strict_types=1`            | [Type declarations](https://www.php.net/manual/en/language.types.declarations.php): "By default, PHP will coerce values of the wrong type into the expected scalar type declaration if possible", and strict mode is enabled "on a per-file basis" | 2026-10-18, PHP 8.5 |
| Native types over docblocks | [Type declarations](https://www.php.net/manual/en/language.types.declarations.php): native declarations "ensure that the value is of the specified type at call time, otherwise a TypeError is thrown", which no docblock does                     | 2026-10-18, PHP 8.5 |
| `===` over `==`             | [Comparison operators](https://www.php.net/manual/en/language.operators.comparison.php): `==` is "equal after type juggling", and the page's warning shows `"1" == "01"` and `100 == "1e2"` both true in PHP 8                                     | 2026-10-18, PHP 8.5 |

## Layout

| Bullet              | Source                                                                                                                                                                                                | Read       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| PSR-4 autoloading   | [PSR-4](https://www.php-fig.org/psr/psr-4/): "This PSR describes a specification for autoloading classes from file paths", and "The terminating class name corresponds to a file name ending in .php" | 2026-10-18 |
| One symbol per file | [PSR-1](https://www.php-fig.org/psr/psr-1/): "This means each class is in a file by itself, and is in a namespace of at least one level"                                                              | 2026-10-18 |

## Data shapes

| Bullet                         | Source                                                                                                                                                                                                                                                                                                                          | Read                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `enum` for a closed set        | [Enumerations](https://www.php.net/manual/en/language.enumerations.overview.php): a type "limited to one of a discrete number of possible values", and [backed enums](https://www.php.net/manual/en/language.enumerations.backed.php) exist for a case that "needs to be able to round-trip to a database or similar datastore" | 2026-10-18, PHP 8.5 |
| `readonly` value objects       | [Properties](https://www.php.net/manual/en/language.oop5.properties.php): `readonly` "prevents modification of the property after initialization", and [a readonly class](https://www.php.net/manual/en/language.oop5.basic.php) adds it "to every declared property"                                                           | 2026-10-18, PHP 8.5 |
| `final` unless designed for it | House choice: a subclass nobody planned for couples to the parent's internals, so a refactor of the parent breaks code its author never saw                                                                                                                                                                                     | 2026-10-18          |
| No associative array boundary  | House choice: a misspelled or missing array key reads as `null` with a warning rather than failing, and no native type declares an array's keys, so the shape drifts unchecked                                                                                                                                                  | 2026-10-18          |

## Errors

| Bullet                        | Source                                                                                                                                                                                                                                                                  | Read                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Domain exception, not `false` | House choice: a caller that forgets to test a `false` or `null` return carries on with a bad value, and `0` and `false` look alike under the loose checks the strictness bullets ban                                                                                    | 2026-10-18          |
| No `@`                        | House choice: [Error control](https://www.php.net/manual/en/language.operators.errorcontrol.php) says `@` suppresses "any diagnostic error that might be generated by that expression", so the failure leaves no trace for whoever debugs it                            | 2026-10-18, PHP 8.5 |
| No `extract` or `eval`        | [eval](https://www.php.net/manual/en/function.eval.php): "very dangerous because it allows execution of arbitrary PHP code. Its use thus is discouraged.", and [extract](https://www.php.net/manual/en/function.extract.php) overwrites a colliding variable by default | 2026-10-18, PHP 8.5 |

## Declined

Every bullet stayed, so nothing was cut. Three were reshaped.

### Merged or reworded

- Reworded "a backed `enum` for a closed set" to an `enum`, backed only when stored or serialized. The manual gives a pure enum for a closed set and a backing value for a datastore round trip.
- Gave the `@` ban an alternative, to check the condition first or catch the exception.
- Gave the `extract`, variable variables, and `eval` ban an alternative, to name each variable and call each function directly.
