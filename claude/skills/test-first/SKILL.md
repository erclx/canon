---
name: test-first
description: Write the failing test for a behavior before writing the code that satisfies it, confirm it fails for the right reason, implement the smallest change that turns it green, then refactor with the suite green. Auto-triggers before implementing a planned feature, adding a function or an endpoint, or extending existing behavior whose new shape is already decided. Do NOT use for a failure with no known cause, which is canon:systematic-debugging, or when the test for the behavior already exists and already passes.
---

# Test first

## The loop

1. Load `canon:test-craft` and pick the layer the test belongs at before writing it. Then find or write the test at that layer before touching the code it covers. Follow the pairing convention the project already uses, which is commonly a test sitting beside its subject under one name, so that `foo.ts` takes `foo.test.ts` beside it. Report it rather than proceeding silently when `canon:test-craft` does not resolve, and write the test at the smallest layer that can observe the behavior.
2. Write the test against the behavior as it should exist once the change lands, naming the case for what it proves rather than for the function it calls.
3. Run only that test and read the failure. Confirm it fails because the behavior is missing, not because of a typo, a missing import, or a signature the test itself got wrong. A test failing for the wrong reason still reads green the moment any code exists to satisfy that wrong reason, so treat any other failure as a defect in the test and fix the test before moving on.
4. Implement the smallest change that turns the failure into a pass. Do not add behavior the test does not ask for. A second behavior wants its own test written first, not a shortcut folded into the change already open.
5. Run the test again and confirm it passes for the reason it was written for, not by accident. Then run the surrounding suite so a change made to satisfy this test has not broken another.
6. Refactor with the suite green. Remove the duplication and the shortcuts step 4 left, in the implementation and in the test, without changing what either does. Run the suite after each change, and undo a change that turns anything red rather than fixing forward.

## Extending existing behavior

- Changing what a function already does starts with changing what its test asserts. Run that changed test once before touching the implementation, and confirm it fails against the code as it stands today.
- A test that already passes before any code changes proves nothing about the new behavior. Widen the assertion or add a case until the suite fails against the current implementation.

## What this skill does not cover

- Which layer a test belongs at and what makes it a good one. `canon:test-craft` owns that judgment, and step 1 loads it.
- A failure with no known cause. Route through `canon:systematic-debugging` first, whose own fix phase already writes the reproducing test as part of finding the cause. This skill starts once the shape of the fix or the feature is already decided.
- Confirming a change looks right once it has landed, which is a separate concern from whether the test passed and runs after implementation rather than before it.
