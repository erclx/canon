---
description: Enforce PHP strict types, PSR-4 layout, immutable data shapes, and exception handling
paths:
  - '**/*.php'
---

# PHP standards

## Strictness

- Open every file with `declare(strict_types=1);`.
- Declare native parameter, return, and property types. Do not rely on a docblock type where a native one exists.
- Compare with `===` and `!==`. Never use loose `==` or `!=`.

## Layout

- Autoload classes through PSR-4 from `composer.json`. Do not `require` a class file by hand.
- Declare one class, interface, trait, or enum per file, named after the file.

## Data shapes

- Use a backed `enum` for a closed set over class constants.
- Use `readonly` properties or a `readonly` class for value objects.
- Declare classes `final` unless they are designed for extension.
- Do not pass an associative array across a public boundary where a typed object fits.

## Errors

- Throw a domain exception for a failure. Do not return `false` or `null` to signal one.
- Never suppress an error with the `@` operator.
- Do not use `extract`, variable variables, or `eval`.
