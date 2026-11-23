---
description: Enforce Vitest, Playwright, and Testing Library patterns for TypeScript test files
paths:
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - '**/*.spec.ts'
  - '**/*.spec.tsx'
---

# TypeScript/JavaScript testing tooling

## End-to-end

- Place every test the Playwright runner executes under `e2e/`, never `src/`. A Vitest test that drives a browser stays beside its module.

## Timers and async

- Pass `advanceTimers: vi.advanceTimersByTime` to `userEvent.setup()` whenever fake timers are on.
- Restore real timers with `vi.useRealTimers()` in `afterEach`, after `vi.runOnlyPendingTimers()`.

## Conventions

- Name a unit test `.test.ts` or `.test.tsx`, and an integration or Playwright test `.spec.ts` or `.spec.tsx`.
