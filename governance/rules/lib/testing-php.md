---
description: Enforce PHPUnit test classes, attributes, and strict assertions for PHP tests
paths:
  - '**/tests/**/*.php'
  - '**/*Test.php'
---

# PHP testing tooling

## Layer

- Load the `canon:test-craft` skill to pick the layer a test belongs at before choosing the tooling below, and report it rather than proceeding silently when the skill does not resolve.

## Framework

- Use PHPUnit for all tests.
- Declare each test class `final` and extend `PHPUnit\Framework\TestCase`.

## Attributes

- On PHPUnit 10 or later, use attributes (`#[Test]`, `#[DataProvider]`, `#[CoversClass]`) over docblock annotations, which PHPUnit 12 no longer reads.
- Use a `public static` data provider method for table-driven cases over per-case test methods.

## Assertions and doubles

- Use `assertSame` over `assertEquals`, which compares with `==`.
- Call `expectException` before the throwing call, over `try` and `catch`, for an expected exception.
- Use `createStub` where no interaction is asserted. Reserve `createMock` for asserting a call.
- Do not make real network calls. Use a fake or a stubbed client.
