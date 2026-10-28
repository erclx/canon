---
name: test-first
description: Write the failing test for a behavior before writing the code that satisfies it, confirm it fails for the right reason, implement the smallest change that turns it green, then refactor with the suite green. Auto-triggers before implementing a planned feature, adding a function or an endpoint, or extending existing behavior whose new shape is already decided. Do NOT use for a failure with no known cause, which is canon:systematic-debugging, or when the test for the behavior already exists and already passes.
metadata:
  family: build
---

# Test first

## The loop

1. Load `canon:test-craft` and pick the layer the test belongs at, then find or write the test there before touching the code it covers.
   - Follow the project's pairing convention, commonly a test beside its subject so that `foo.ts` takes `foo.test.ts`
   - Report it rather than proceeding silently when `canon:test-craft` does not resolve, and write the test at the smallest layer that can observe the behavior
2. Write the test against the behavior as it should exist once the change lands, naming the case for what it proves rather than for the function it calls.
3. Run only that test and confirm it fails because the behavior is missing, not because of a typo, a missing import, or a signature the test got wrong.
   - A test failing for the wrong reason reads green the moment any code satisfies that reason, so fix the test before moving on
4. Load `canon:code-craft` and settle the shape of the code, unless the shape is already fixed or this session already loaded it. Then make the smallest change that turns the failure into a pass.
   - Report it rather than proceeding silently when `canon:code-craft` does not resolve, and write the plainest code the test asks for
   - Add no behavior the test does not ask for. A second behavior wants its own test written first.
5. Run the test again and confirm it passes for the reason it was written for. Then run the surrounding suite so this change has not broken another.
6. Refactor with the suite green, removing the duplication and shortcuts step 4 left in the code and the test without changing what either does.
   - Run the suite after each change, and undo a change that turns anything red rather than fixing forward

## Extending existing behavior

- Changing what a function does starts with changing what its test asserts. Run that test once before touching the code, and confirm it fails against the code as it stands.
- A test that passes before any code changes proves nothing about the new behavior. Widen the assertion or add a case until it fails against the current code.

Read `${CLAUDE_SKILL_DIR}/references/adopted.md` only when extending this guidance or arguing against a rule in it. It records which external sources the loop matches, which parts were declined, and which rules no source states.

## What this delegates

- Which layer a test belongs at and what makes it a good one. `canon:test-craft` owns that judgment, and step 1 loads it.
- A failure with no known cause. Route through `canon:systematic-debugging`, whose fix phase writes the reproducing test. This skill starts once the fix's shape is decided.
- Committing the green, refactored behavior as one slice of a larger build. `canon:build-in-slices` owns the commit and the order slices land in.
- Confirming a change looks right once it has landed, which runs after implementation and is separate from whether the test passed
