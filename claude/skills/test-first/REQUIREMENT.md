---
name: test-first
description: Why the loop exists and where it stops short of a debugging session or a visual check
---

# Test first requirement

## Gap

Without this skill, a session implementing a planned change writes the test after the code, or writes both in one motion and never runs the test against the code as it stood before. Either way, nothing showed that the test would have caught the defect it exists to catch, so a test added after the fact protects nothing beyond what the author was already confident about.

## Must

- Write or extend the test before the implementation it covers, for any behavior whose shape is already known
- Run the test before implementing and confirm it fails for the missing behavior, not for an unrelated mistake in the test itself
- Implement the minimum the current test demands, and start a new test before extending past it
- Re-run the test after implementing and confirm the pass is the one the test was written to prove
- Refactor the implementation and the test once the suite is green, re-running it after each change, since the smallest change that passes leaves duplication and shortcuts the loop exists to remove before they reach history

## Must not

- Write the implementation and the test together with the test never run red first
- Treat a test that already passes before any code change as evidence for the new behavior
- Restate the reproducing-test step `canon:systematic-debugging` already owns for a failure with no known cause
- Decide whether a change looks right visually, which runs after implementation as a separate check

## Guards

- A test failing for a reason other than the missing behavior blocks moving to implementation. Fix the test first.

## Out of scope

- Choosing the layer a test belongs at and judging whether it is a good test: `canon:test-craft`, loaded at step 1 rather than restated here
- Finding the cause of an unexplained failure: `canon:systematic-debugging`
- Confirming visual output after a change lands: `070-planning.md` states the order and `ui-checklist` writes the list to confirm against
- The mechanical audit of whether an implementation reached history ahead of its test: `canon gov test-order`, invoked from `auto-ship`
