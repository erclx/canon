---
name: test-craft
description: Why a session writing a test needs a stated layer rule and a quality filter, and where that judgment stops short of the procedures that run it
---

# Test craft requirement

## Gap

A session writing a test has no surface telling it which layer the test belongs at or what makes one good. It writes whatever the touched file suggests, and the suite inverts into hundreds of end to end tests over a few unit files, with timing-sensitive assertions at the layer where load decides the result.

A stated rule is one a session talks itself out of, since each misplaced test sat where it did for a reason that sounded fine. A path-scoped rule does not reach the first test of a feature either, because it loads on a matching file the write has not created yet.

## Must

- Pick the smallest layer that can fail for the behavior from a decision guide keyed on what it touches, splitting a behavior that spans rows into one test per layer
- Open every test with the question of which production change makes it fail, and whether that change is a bug or a decision
- Run a final filter over each test, covering mirror assertions, change detectors, mock assertions, fixed pauses, and the mutation check, and rewrite or cut one that fails
- Hold the structure floors in the body and each layer's specifics in a reference loaded only for that layer
- Load on writing or changing any test, after implementing as well as before, and close with excuses, red flags, and a checklist

## Must not

- Name a framework or runner in the body, or carry a numeric mix across layers
- Restate the settle, guard, and run-scope rules the end to end rules carry
- Decide the order of red, green, and refactor

## Out of scope

- The red, green, refactor loop, which `test-first` owns
- Reproducing a failure with no known cause, which `systematic-debugging` owns
- Writing a UI change's visual checklist, which `ui-checklist` owns
- Grading the tests a pull request adds, which `review-pr` owns
