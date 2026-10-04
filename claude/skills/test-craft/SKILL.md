---
name: test-craft
description: Carries the rule that decides which layer a test belongs at, the question each one opens with, the end to end budget, and the final filter a session runs over what it wrote. Use when writing, changing, or judging a test, after implementing as well as before, when adding a regression guard, when choosing between unit, component, or end to end, or when asked "where should this test go", "is this a good test", "should this be an e2e test", or "why is our e2e suite so slow". Do NOT use for the red, green, refactor procedure, which is `test-first`, or for a bug nobody has explained yet, which is `systematic-debugging`.
metadata:
  family: build
---

# Test craft

A session with no stated layer writes the test the file it is touching suggests, so a loading state lands in a full browser run and an end to end suite grows past what it guards. This skill carries the judgment: where a test belongs, what it has to prove, and what to cut before handing it over.

Load it before writing a test rather than after. A test written at the wrong layer passes review, and moving it later costs a second test.

## Open every test with one question

Ask what production change makes this test fail, and whether that change is a bug or a decision.

- A bug is what the test exists for. Write it.
- A decision, such as a reworded message or a reordered field, makes the test a change detector. Assert the contract the decision serves, or drop the test.
- No answer means the test proves nothing yet. Name the break before writing the assertion.
- Cover the edges of a behavior as well as its main path: the empty input, the boundary value, the refused call. Each edge is its own case at the same layer.

## Put the test at the smallest layer that can catch the break

Size a test by what it touches rather than by what it covers. Pick the first row that can observe the break:

| The behavior touches                                                                 | Layer                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------- |
| Logic with no rendering and no I/O: a parser, a reducer, a formatter, a rule         | Unit                                  |
| A module boundary on one machine: a file, a local database, a handler with its route | Integration, still in the unit runner |
| Rendered behavior: states, interactions, conditional rendering, validation, focus    | Component                             |
| A journey across routes, or what only a real browser renders: layout, scroll, motion | End to end                            |

- Read the row off the behavior, never off the file. A component file holding a pure formatter takes a unit test for the formatter.
- Split a behavior that spans rows. Test the copy at unit and the render at component, rather than asserting both in one browser run.
- Write the lower test when a higher one catches a break no lower test did. A red end to end run with every unit and component test green names a missing lower test.
- Reach for a real-browser component test before end to end when a simulated DOM cannot render the behavior. The middle layer exists for layout and scroll too.

## Spend end to end on journeys

- Cover the journeys a user cannot lose without the product failing, and what no lower layer can render.
- Never write an end to end test for a state a component test can reach, whether loading, empty, error, or a toggle.
- Count a new end to end test as a cost every later run pays. A suite grows by quality rather than by count, which is what keeps continuous integration fast.
- Carry no numeric mix. The right shape follows the architecture, and a ratio across a codebase is a target nobody writing one test can act on.

## Keep test code readable over clever

- Prefer a descriptive, repeated arrange over a shared helper a reader has to open. A test is read when it fails, by someone who did not write it.
- Assert through the public surface a caller uses. A test reaching into internals breaks on every refactor and catches nothing a caller sees.
- Prefer a real collaborator, then a fake, then a stub, and a mock last. A mock asserts how the code is built rather than what it does.

## Read the reference for the layer

Read the one reference matching the layer the table picked, before writing the first test at it. Skip the other two.

- Unit and integration: `${CLAUDE_SKILL_DIR}/references/unit.md`
- Component: `${CLAUDE_SKILL_DIR}/references/component.md`
- End to end: `${CLAUDE_SKILL_DIR}/references/e2e.md`

Read `${CLAUDE_SKILL_DIR}/references/adopted.md` only when extending this guidance or arguing against a rule in it. It records which external patterns were adopted, which declined, and why.

## Excuses and rebuttals

| Excuse                                                     | Rebuttal                                                                                                         |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| The end to end spec is already open, so add the case there | An open file is not a layer. Read the row off the behavior, and a loading, empty, or error state is a component. |
| The test is small, so its layer does not matter            | A small test at the wrong layer is run by every later pass, and moving it costs a second test.                   |
| The copy is what the user sees, so assert it in a browser  | Copy asserted in a browser run fails every engine on one wording change. Assert copy at unit.                    |
| It only flakes under CI load, so add a pause               | A pause hides the condition the run is waiting on. Settle on the condition, or move the assertion down a layer.  |
| A mock is quicker to set up than the real collaborator     | A mock proves how the code is built. Take a real collaborator or a fake first.                                   |

## Red flags

- You are opening an end to end spec to add a state rather than a journey.
- The expected value comes from calling the function under test.
- A sleep, a timeout, or a retry count is going in to make a run pass.
- The only assertion is that a double was called.
- You picked the layer before naming what production change makes the test fail.

## Before handing over

Run the final filter over every test written this session, checking each line. A test that fails one is rewritten or cut, never kept with a note.

- **Mirror assertion.** The expected value is computed by the code under test. Write the literal the behavior should produce.
- **Change detector.** The assertion pins a constant, a message's wording, or a markup shape no caller depends on.
- **Assertion on a mock.** The test proves a double was called rather than that the behavior happened.
- **Framework behavior.** The test proves the runtime, the router, or the library works rather than this code's contract.
- **Fixed pause.** A sleep or timeout stands in for a condition. Settle on the condition instead.
- **Mutation check.** Break the code under test in three to five plausible ways in your head. At least one test fails for each, or a case is missing.

## What this delegates

- The red, green, refactor procedure and its order: `test-first`, which loads this skill at its first step
- Reproducing a failure with no known cause: `systematic-debugging`
- Test structure floors such as arrange, act, assert, one behavior per test, isolation, and no snapshots: `010-testing`
- Runner, file suffix, placement, and query conventions per language: `300-testing-ts`, `330-testing-py`, `335-testing-go`, and `336-testing-php`
- Settle, guard, and run-scope rules inside an end to end file: `305-e2e-reliability` and `306-test-scope`
