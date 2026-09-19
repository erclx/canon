---
title: Unit and integration tests
description: Doubles in preference order, descriptive over shared setup, table-driven cases, and the mutation check, for tests that run in one process
---

# Unit and integration tests

Read this before writing the first test at the unit or integration layer. A unit test runs in one process with no network, no sleep, and no real I/O. An integration test may touch the local machine, such as a temporary directory or a local database, and nothing beyond it. Google's size vocabulary draws the same line by what a test may touch rather than what it covers ([Software Engineering at Google, ch. 11](https://abseil.io/resources/swe-book/html/ch11.html)).

## Doubles

Prefer the most real collaborator the test can afford, in this order (`addyosmani/agent-skills@c004a74`, `skills/test-driven-development/SKILL.md`):

1. **Real.** The actual collaborator, when it is fast and deterministic. A pure function never needs a double.
2. **Fake.** A working implementation with a shortcut, such as an in-memory store standing in for a database.
3. **Stub.** Canned answers to the calls the test makes, with no assertions of its own.
4. **Mock.** A double that asserts how it was called. Reach for it only when the call itself is the contract, such as a payment that must be sent exactly once.

- Double only at a boundary the project does not own or cannot run locally: the network, the clock, randomness, a third-party service.
- Never assert that a mock exists or was constructed. That proves the test's own setup rather than the code (`obra/superpowers@5bf4e78`, `skills/test-driven-development/writing-good-tests.md`).
- Control the clock and randomness through an injected source rather than patching a global for the whole file.

## Descriptive over shared

- Prefer DAMP over DRY in a test body: descriptive and meaningful phrases a reader follows without opening a helper (`addyosmani/agent-skills@c004a74`, `skills/test-driven-development/SKILL.md`).
- Extract a factory for the data a test builds, and keep the values that matter to this case visible at the call site.
- Never share mutable state between tests. A test passing only after another one ran is two tests pretending to be one.

## Table-driven cases

- Write one table when several inputs exercise the same behavior and differ only in value. Each row names the case it proves.
- Keep a row to input and expected output. A row carrying its own branch of setup is a separate test.
- Split the table when a case needs a different assertion. A conditional inside the loop body is the loop hiding a second behavior.

## Integration at a boundary

- Test a module through the interface its callers use, with its real neighbors on the same machine.
- Use a temporary directory or an isolated database per test, created and removed by the test, never a shared fixture a previous run left behind.
- Cover the failure path at the boundary: the missing file, the refused write, the malformed record. That is where an integration test earns its extra cost over a unit test.

## The mutation check

Run it on each new test before calling it done (`obra/superpowers@5bf4e78`, `skills/test-driven-development/writing-good-tests.md`):

1. Name three to five plausible breaks in the code under test: an off-by-one, a flipped condition, a dropped branch, a wrong default, a swallowed error.
2. For each, say which test fails.
3. A break no test catches is a missing case. Write it, or state why the break is not a bug.

A mutation testing tool automates the same check across a codebase. The manual pass here is the version a session writing one test can run.
