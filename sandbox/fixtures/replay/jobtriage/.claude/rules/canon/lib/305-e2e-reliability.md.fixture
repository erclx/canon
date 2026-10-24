---
description: Enforce settled waits and falsifiable guards in end-to-end tests
paths:
  - 'e2e/*.ts'
  - 'e2e/**/*.ts'
---

# End-to-end reliability standards

## Waiting

- Settle on the condition a step waits for. Use `expect.poll` or a web-first assertion ahead of any read.
- Reserve a fixed duration for an assertion that nothing happened across a window.
- Bound every settle with an explicit timeout.
- Do not raise a timeout to clear a failure that reproduces under load. Replace the wait with a settle.
- Do not read a value once after a pause. Poll it.

## Falsifiable guards

- Assert the set under test is non-empty before asserting a property over its members.
- Raise from an instrument that was refused rather than returning a value a passing assertion accepts.
- Run a new guard against the defect it was written for, and see it fail, before trusting it.
- Do not weaken an assertion to clear a failure. Narrow the wait instead.

## Reproducing a failure that only appears in CI

- Reproduce under `Emulation.setCPUThrottlingRate` rather than by rerunning the gate.
- Read the state the assertion does not: which markers were set, which listeners fired, how far a transition ran.
- Vary the condition under suspicion deliberately. Do not compare counts across runs that differed in something uncontrolled.
- Read the check conclusion as its own act. A green diff review reports nothing about the gate.

## Authority

- Follow `.claude/rules/canon/lib/300-testing-ts.md` for framework choice, file placement, and test naming.
