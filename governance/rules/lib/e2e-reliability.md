---
description: Enforce settled waits and falsifiable guards in end-to-end tests
paths:
  - '**/e2e/**/*.ts'
---

# End-to-end reliability standards

## Waiting

- Settle on the condition a step waits for with a web-first assertion or `expect.poll`, never `page.waitForTimeout`.
- Reserve a fixed duration for an assertion that nothing happened across a window.
- Bound every settle with an explicit timeout. `toPass` defaults to none and ignores the expect timeout.
- Do not raise a timeout to clear a failure that reproduces under load. Replace the wait with a settle.
- Settle a smooth scroll on the `scrollend` event. Fall back to a stillness window only when the target was already in view.
- Run with `reducedMotion: 'reduce'` unless the test asserts motion, and opt back in per test.

## Falsifiable guards

- Assert the set under test is non-empty before asserting a property over its members.
- Raise from an instrument that was refused rather than returning a value a passing assertion accepts.
- Run a new guard against the defect it was written for, and see it fail, before trusting it.
- Do not weaken an assertion to clear a failure. Narrow the wait instead.

## Reproducing a failure that only appears in CI

- Reproduce under `Emulation.setCPUThrottlingRate` rather than by rerunning the gate.
- Read the failure's trace for the state the assertion does not read, such as which markers were set and which listeners fired.
- Vary the condition under suspicion deliberately. Do not compare counts across runs that differed in something uncontrolled.

## Authority

- Follow `.claude/rules/canon/lib/testing-ts.md` for framework choice, file placement, and test naming.
