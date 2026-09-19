---
name: test-craft
description: Why a session writing a test needs a stated layer rule and a quality filter, and where that judgment stops short of the procedures that run it
---

# Test craft requirement

## Gap

Without this skill, a session writing a test has no surface telling it which layer the test belongs at or what makes one good. It writes whatever the touched file suggests, and nothing in the toolkit corrects that choice before the test lands.

The one surface that did pick a layer picked the expensive one. The UI test skill routed interactions, state transitions, loading, empty, and error states to a browser end to end run, the opposite of every external source read. `test-first` runs red and green with no layer choice and no refactor step. The testing rule states floors on structure and says nothing about layer.

The failure is measured on a real target. A single-page portfolio site carried 219 end to end tests against 4 unit test files, an inverted pyramid. Its suite could not raise its worker count without failing between 11 and 24 tests on every retry, because timing-sensitive assertions sat at the layer where CI load decides the result. One copy edit failed three engines because the copy was asserted in a browser run.

Moving the guidance into a path-scoped rule does not reach the session that needs it. A path-scoped rule loads when a session reads a matching file and not when it creates one, measured in three headless runs, so a rule scoped to test files is silent on the first test of every feature.

## Must

- State the smallest-layer rule with a decision guide keyed on what the behavior touches, so a session picks a layer from the behavior rather than from the file it is in
- Open every test with the question of which production change makes it fail and whether that change is a bug or a decision, since a test with no answer proves nothing
- State the end to end budget in words: journeys and what only a real browser renders, never a state a component test reaches
- Carry a final filter the session runs over its own tests, each item a shape it can check: mirror assertion, change detector, assertion on a mock, framework behavior, fixed pause, and the mutation check
- Hold in the body what every test decision pays for, and defer each layer's specifics to a reference loaded only when a test at that layer is being written
- Promise a middle layer for behavior a simulated DOM cannot render, naming the real-browser component runners, so a static site is not left choosing between a simulated DOM that computes no layout and a whole-site run
- Repeat in the end to end reference the two floors a session writing its first spec never loads through the path-scoped rule, being the `scrollend` settle and motion reduced by default
- Record the external patterns adopted and declined with the reason for each, so a later session extends the position instead of re-deriving it
- Trigger on writing or changing any test, after implementing as well as before, since regression tests and end to end tests are mostly written after the code exists

## Must not

- Name a framework or runner in the body. Runner specifics live in the references and in the language testing rules, so the body holds across stacks.
- Carry a numeric mix across layers. A codebase-wide ratio is a target a session writing one test cannot act on.
- Restate the structure floors the testing rule already carries, such as arrange, act, assert, one behavior per test, isolation, and no snapshots
- Restate the settle, guard, and run-scope rules the end to end rules carry, beyond the two floors named above
- Run the red, green, refactor procedure or decide its order, which `test-first` owns
- Import an external skill's tone, such as a law stated as absolute or a table of rationalizations with rebuttals
- Be reached only by an author typing its name. The intended non-author callers are `test-first`'s first step and a description matching any request to write or change a test. A test written in a session that never loaded this skill is the evidence the trigger is too weak, and nothing answers that before the skill has run.

## Guards

- A behavior spanning more than one row of the decision guide is split into one test per layer rather than asserted whole at the highest layer it touches
- A test failing the final filter is rewritten or cut, never kept with a note

## Out of scope

- The red, green, refactor loop and the order it runs in: `test-first`, which loads this skill at its first step
- Reproducing a failure with no known cause: `systematic-debugging`
- Structure floors for every test: the core testing rule
- Runner choice, file suffix, placement, and query conventions: the TypeScript and Python testing rules
- Settle, guard, and run-scope rules inside an end to end file: the end to end reliability and test scope rules
- Writing a UI change's visual checklist, and naming the behaviors it ships untested for this skill to place: `ui-checklist`
- Grading the tests a pull request adds: `review-pr`
- Whether the guidance moves where a session puts a test, which needs a measured with-and-without run rather than a rule here

## Measured

2026-09-19, one Sonnet run per arm over the `pull` arm of the toolkit's own sandbox scenario for this skill, a page with an end to end spec already beside it and a prompt adding a loading state.

- With the skill: the loading state landed in a new component test and the existing end to end spec stayed unchanged.
- Without it, on a plugin dir lacking the skill: no `Skill` call fired, and the run made the same placement, one component test with three cases and the spec unchanged.

The arm did not discriminate, so the run shows no movement from the skill. It also shows that the pull toward extending an existing spec is too weak to move an unaided session, which is a fixture finding and not evidence about the body. A stronger pull, such as a prompt naming the spec, is the next arm to try before reading this as a rework signal on the skill. One run per arm on one model cannot separate a difference of one test from noise.
