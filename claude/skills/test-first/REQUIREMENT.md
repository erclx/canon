---
name: test-first
description: Why the loop exists and where it stops short of a debugging session or a visual check
---

# Test first requirement

## Gap

A session implementing a planned change writes the test after the code, or writes both in one motion and never runs the test against the code as it stood before. Nothing shows the test would have caught the defect it exists to catch, so a test added after the fact protects nothing beyond what the author already trusted.

## Must

- Write or extend the test before the implementation, for any behavior whose shape is already known
- Run the test before implementing and confirm it fails for the missing behavior rather than a mistake in the test
- Implement the minimum the current test demands, then start a new test before extending past it
- Load `code-craft` before the implementation when its shape is still open, then confirm the pass is the one the test was written to prove
- Refactor the implementation and the test once the suite is green, re-running it after each change

## Must not

- Write the implementation and the test together with the test never run red first
- Treat a test that passes before any code change as evidence for the new behavior
- Move to implementation while the test fails for a reason other than the missing behavior
- Decide whether a change looks right visually

## Out of scope

- Choosing a test's layer and judging whether it is good, which `test-craft` owns
- Finding the cause of an unexplained failure, which `systematic-debugging` owns
- Shaping the function, class, or module the implementation writes, which `code-craft` owns
- Committing the behavior as a slice, which `build-in-slices` owns
- Confirming visual output after a change lands, which `ui-checklist` owns
