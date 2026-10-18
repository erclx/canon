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
- Simulate interaction with `userEvent` over `fireEvent`, since it refuses what a browser would, such as a click on a hidden element.
- Mock the network with MSW. Never mock `fetch` or axios by hand, and never let a unit test make a real call.
- Query by role or label first, such as `getByRole` and `getByLabelText`, and by test ID only when neither matches.

## End-to-end

- Use Playwright for end-to-end tests.
- Place every test the Playwright runner executes under `e2e/`, never `src/`. A Vitest test that drives a browser stays beside its module.

## Timers and async

- Pass `advanceTimers: vi.advanceTimersByTime` to `userEvent.setup()` whenever fake timers are on.
- Restore real timers with `vi.useRealTimers()` in `afterEach`, after `vi.runOnlyPendingTimers()`.

## Conventions

- Name a unit test `.test.ts` or `.test.tsx`, and an integration or Playwright test `.spec.ts` or `.spec.tsx`.
