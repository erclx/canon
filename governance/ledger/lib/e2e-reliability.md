---
title: End-to-end reliability rule ledger
description: Sources for governance/rules/lib/e2e-reliability.md, one row per bullet
---

# End-to-end reliability rule ledger

The field is browser test automation. The authorities are the Playwright documentation at playwright.dev, MDN for the `scrollend` event, and the Chrome DevTools Protocol definition for CPU throttling. A guard bullet is a house choice wherever no page takes a side, and each such row names the false pass it prevents. None of the pages read names a Playwright major, so the rows record the read date alone.

## Waiting

| Bullet                         | Source                                                                                                                                                                                                                                                                                                         | Read       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Settle, never `waitForTimeout` | [Page API](https://playwright.dev/docs/api/class-page): `waitForTimeout` is "Discouraged", since "Tests that wait for time are inherently flaky", and [assertions](https://playwright.dev/docs/test-assertions): "You can convert any synchronous `expect` to an asynchronous polling one using `expect.poll`" | 2026-10-18 |
| Fixed window for absence       | House choice: an absence has no signal to settle on, so a web-first assertion of it passes before the thing it rules out has had time to happen                                                                                                                                                                | 2026-10-18 |
| Bound every settle             | [Assertions](https://playwright.dev/docs/test-assertions): "by default `toPass` has timeout 0 and does not respect custom" expect timeouts                                                                                                                                                                     | 2026-10-18 |
| No raised timeout under load   | House choice: a longer timeout hides a race that the load exposed, and it returns on a slower runner                                                                                                                                                                                                           | 2026-10-18 |
| `scrollend`, then stillness    | [MDN scrollend](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event): "If the scroll position did not change, then no scrollend event fires"                                                                                                                                              | 2026-10-18 |
| Reduced motion by default      | [Test options](https://playwright.dev/docs/api/class-testoptions): `reducedMotion` "Emulates `'prefers-reduced-motion'` media feature"                                                                                                                                                                         | 2026-10-18 |

## Falsifiable guards

| Bullet                   | Source                                                                                                                                   | Read       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Non-empty before every   | House choice: a property asserted over an empty set holds vacuously, so the guard passes on the page that lost every member              | 2026-10-18 |
| Raise when refused       | House choice: an instrument returning a default on refusal hands the assertion a value it accepts, so the guard passes without measuring | 2026-10-18 |
| See the guard fail first | House choice: a guard never run against its defect may pass on the defect too, and nothing tells the two apart                           | 2026-10-18 |
| Never weaken to pass     | House choice: a loosened assertion passes on the defect it was written to catch, where a narrowed wait keeps the check                   | 2026-10-18 |

## Reproducing a failure that only appears in CI

| Bullet                      | Source                                                                                                                                                                                          | Read       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| CPU throttling to reproduce | [DevTools Protocol, Emulation](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/): `setCPUThrottlingRate` "Enables CPU throttling to emulate slow CPUs", as a "slowdown factor" | 2026-10-18 |
| Read the trace              | [Best practices](https://playwright.dev/docs/best-practices): "For CI failures, use the Playwright trace viewer instead of videos and screenshots"                                              | 2026-10-18 |
| Vary one condition          | House choice: two runs that differ in an uncontrolled condition cannot attribute a change in count to the one under suspicion                                                                   | 2026-10-18 |

## Authority

| Bullet                  | Source                                                                                              | Read       |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ---------- |
| Pointer to `testing-ts` | House choice: a pointer to the rule that owns placement and naming, claiming no practice of its own | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Cut from the subject

- Cut "read the check conclusion as its own act, since a green diff review reports nothing about the gate". It governs reading CI after a push, which the ship and review skills own, and an end-to-end file is the wrong trigger for it.

### Merged or reworded

- Merged "do not read a value once after a pause, poll it" into the settle bullet, which now names `page.waitForTimeout` as the call it bans.
- Reworded "bound every settle with an explicit timeout" to name `toPass`, the one settle the docs leave unbounded.
- Reworded "run with motion reduced" to name the `reducedMotion` option.
- Reworded "read the state the assertion does not" to read it from the trace, which the best practices page names for a CI failure.
