---
title: End to end tests
description: Which journeys earn a browser run, how to settle rather than pause, why motion is off by default, and how isolation and sharding keep the suite fast, with two worked failures
---

# End to end tests

Read this before writing the first end to end test for a change. A browser run across the real site is the most expensive test a project owns and the most exposed to timing, so every one written here has to be one no lower layer could have been.

Read the settle, guard, and run-scope rules in the project's end to end reliability and test scope rules once they load. They fire on a read of an existing end to end file, and not on the creation of a new one, so the two floors below are repeated here for the session writing its first spec.

## What earns a browser run

- A journey a user cannot lose without the product failing, crossing more than one route: sign up, check out, publish ([Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)).
- Behavior only a real browser computes across the whole page: layout at a breakpoint, scroll position, focus crossing a route, motion.
- Not a state a component test can reach. Loading, empty, and error states, a toggle, and a validation message belong one layer down, even when the component sits on a page with other end to end coverage.
- Not copy. Asserting exact wording in a browser run makes every copy edit a failure across every engine the gate runs.

Suites dominated by end to end tests inflate both runtime and flake ([Google Testing Blog, 2015](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)). Nothing fixes a count ceiling, and the right shape depends on the architecture ([Pyramid or Crab](https://web.dev/articles/ta-strategies)). A site whose behavior is mostly layout and motion carries more browser tests than a form-heavy app, and each one still has to earn its place.

## Settle on conditions

- Assert with a web-first assertion that retries until the condition holds. A manual visibility check reads once and does not retry ([best practices](https://playwright.dev/docs/best-practices)).
- Lean on actionability for clicks and fills. An element counts as stable once it "has maintained the same bounding box for at least two consecutive animation frames", so an action waits out an animation on its own ([actionability](https://playwright.dev/docs/actionability)). A read does not wait, so poll it.
- Never pause for a fixed duration to stand in for a condition. Reserve a fixed window for asserting that nothing happened across it.
- Settle a smooth scroll on the `scrollend` event. Fall back to a stillness window only when the target was already in view.

## Motion off by default

- Run with motion reduced unless the test asserts motion, and opt back in per test with `page.emulateMedia({ reducedMotion: 'no-preference' })`.
- Set it once in the config's `use` block as `reducedMotion: 'reduce'` rather than per test, since the option defaults to `'no-preference'` ([TestOptions](https://playwright.dev/docs/api/class-testoptions)). A site honoring the reduced preference then has nothing to wait out in any test that does not opt back in.

## Isolation and speed

- Give every test its own state: a fresh context, its own account or seed, nothing left behind for the next test.
- Speed a slow suite with parallel workers and sharding across machines rather than by cutting waits ([best practices](https://playwright.dev/docs/best-practices)). A suite that fails once workers rise carries timing-sensitive assertions, and those are the tests to move down a layer.
- Capture a trace on the first retry rather than a video on every run ([best practices](https://playwright.dev/docs/best-practices)).
- Count the cost before adding a test: its runtime, times every engine in the matrix, times every push. That product is what the gate charges each later change.

## Two worked failures

**A copy assertion in a browser run.** A portfolio site's home spec asserted the exact wording of its about section. A one-line copy edit then failed three engines in continuous integration, and the deploy waited on it. The production change that broke the test was a decision rather than a bug, which makes the assertion a change detector. The copy belonged in a unit test beside the module that holds it, and the browser run needed at most the section's presence.

**A settle that narrowed a failure without removing it.** A focus-ring spec waited on a scripted focus read with a condition wait, replacing a fixed pause. The next push to the trunk still failed one engine on every attempt with the condition timing out, and flaked a second test in the same file, which skipped the deploy. The settle was correct and the layer was wrong: an assertion whose result depends on how loaded the CI machine is keeps failing at the layer where load decides it. Moving the focus behavior to a real-browser component test takes it off the whole-site run.
