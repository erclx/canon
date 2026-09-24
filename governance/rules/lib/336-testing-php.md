---
description: Enforce PHPUnit test classes, attributes, and strict assertions for PHP tests
paths:
  - 'tests/**/*.php'
  - '**/*Test.php'
---

# PHP testing tooling

## Layer

- Load the `canon:test-craft` skill to pick the layer a test belongs at before choosing the tooling below, and report it rather than proceeding silently when the skill does not resolve.

## Framework

- Use PHPUnit for all tests.
- Declare each test class `final` and extend `PHPUnit\Framework\TestCase`.
- Place tests under `tests/`, mirroring the `src/` namespace layout, in files named `*Test.php`.

## Attributes

- Use attributes (`#[Test]`, `#[DataProvider]`, `#[CoversClass]`) over docblock annotations.
- Use a static data provider method for table-driven cases over per-case test methods.

## Assertions and doubles

- Use `assertSame` over `assertEquals`.
- Use `expectException` over `try` and `catch` for expected exceptions.
- Use `createStub` where no interaction is asserted. Reserve `createMock` for asserting a call.
- Do not make real network calls. Use a fake or a stubbed client.
