---
description: Enforce universal testing standards and best practices
---

# Testing standards

## Test structure

- Structure tests using the Arrange, Act, Assert (AAA) pattern.
- Each test should verify a single behavior.
- Do not use conditional logic or loops within test bodies.

## Test focus

- Test user-visible behavior rather than implementation details.
- Do not test private functions or internal state directly.
- Cover critical paths and edge cases.
- Do not target arbitrary coverage percentages.

## Organization and isolation

- Group related tests using the framework's nesting mechanism.
- Keep nesting shallow (max 2 levels).
- Ensure tests are independent with no shared side effects.
- Clean up side effects and restore state after each test.

## Test data and async

- Use factory functions or builders for test data over inline object literals.
- Always await async operations.
- Do not fire-and-forget promises in tests.

## Verification

- Do not use snapshot testing for verification.
