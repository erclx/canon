---
description: Enforce Vitest, Playwright, and Testing Library patterns for TypeScript test files
paths:
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - '**/*.spec.ts'
  - '**/*.spec.tsx'
---

# TypeScript/JavaScript testing tooling

## Unit and integration

- Use Vitest for unit and integration tests.
- Co-locate unit tests with their respective components.
- Use `userEvent` over synthetic events for interaction simulation.
- Use MSW for network mocking. Do not mock fetch or axios manually.
- Select elements by accessibility attributes first (`getByRole`, `getByLabelText`).

## End-to-end

- Use Playwright for end-to-end tests.
- Place all Playwright tests within the `e2e/` directory.
- Never place Playwright tests inside `src/`.
- Scope the three rules above to tests the Playwright runner executes. A Vitest test importing a browser driver to exercise project code stays beside its module, where Vitest looks for it.

## Timers and async

- Never use `vi.useFakeTimers()` in `beforeEach` when tests use `waitFor`, `act`, or `userEvent`.
- Scope fake timers to the individual test that needs them.
- Restore real timers with `vi.useRealTimers()` in a matching `afterEach`.

## Conventions

- Use `.test.ts` / `.test.tsx` for unit tests.
- Use `.spec.ts` / `.spec.tsx` for integration tests and for Playwright tests under `e2e/`.
- Do not make real network calls in unit tests.
- `describe()` labels use the exact identifier of the subject under test in its natural casing.
- `it()` descriptions use "should" + sentence case.
