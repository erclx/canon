---
title: TypeScript testing rule ledger
description: Sources for governance/rules/lib/testing-ts.md, one row per bullet
---

# TypeScript testing rule ledger

The field is JavaScript and TypeScript testing. The authorities are the Vitest documentation at vitest.dev, the Testing Library documentation at testing-library.com, and the Playwright documentation at playwright.dev. None of the pages read names a major, so the rows record the read date alone.

## Unit and integration

| Bullet                           | Source                                                                                                                                                                                                                                | Read       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Vitest as the runner             | House choice: the toolkit's web stacks install and configure Vitest, so a test written for a second runner never runs in the gate                                                                                                     | 2026-10-18 |
| `userEvent` over `fireEvent`     | [user-event](https://testing-library.com/docs/user-event/intro): it "factors in that the browser e.g. wouldn't let a user click a hidden element or type in a disabled text box"                                                      | 2026-10-18 |
| MSW, no hand mocks or real calls | [Vitest, mocking requests](https://vitest.dev/guide/mocking/requests): "We recommend Mock Service Worker to accomplish this", since it mocks "http, WebSocket and GraphQL network requests"                                           | 2026-10-18 |
| Role or label first              | [Testing Library queries](https://testing-library.com/docs/queries/about): `getByRole` "should be your top preference for just about everything", and a test ID "is only recommended for cases where you can't match by role or text" | 2026-10-18 |

## End-to-end

| Bullet                        | Source                                                                                                                                                                            | Read       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Playwright for end-to-end     | House choice: the toolkit's web stack configures Playwright, so a second browser runner's tests never run in the gate                                                             | 2026-10-18 |
| Playwright tests under `e2e/` | [Vitest include](https://vitest.dev/config/include) defaults to `**/*.{test,spec}.?(c\|m)[jt]s?(x)`, so a Playwright spec under `src/` is collected by Vitest too, where it fails | 2026-10-18 |

## Timers and async

| Bullet                           | Source                                                                                                                                                                                                               | Read       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `advanceTimers` with fake timers | [user-event options](https://testing-library.com/docs/user-event/options): "When using fake timers it is necessary to set this option to your test runner's time advancement function"                               | 2026-10-18 |
| Restore after pending timers     | [Using fake timers](https://testing-library.com/docs/using-fake-timers): "you usually call `useRealTimers` in `afterEach`", and "It's important to also call `runOnlyPendingTimers` before switching to real timers" | 2026-10-18 |

## Conventions

| Bullet                              | Source                                                                                                                                                                                                                   | Read       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `.test` for unit, `.spec` otherwise | House choice: [Playwright](https://playwright.dev/docs/test-configuration) runs "`**/*.@(spec\|test).?(c\|m)[jt]s?(x)` files" and Vitest matches the same pair, so the suffix is what a config separates the two runs on | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the docs

- Cut "never use `vi.useFakeTimers()` in `beforeEach` when tests use `waitFor`, `act`, or `userEvent`". [Using fake timers](https://testing-library.com/docs/using-fake-timers) shows `beforeEach` as the usual setup, and names `advanceTimers` as the fix for the `userEvent` timeout, which the kept bullet carries.
- Cut "scope fake timers to the individual test that needs them" with it, since no page read scopes them below the file.

### Cut without a source or a bug class

- Cut "`it()` descriptions use "should" + sentence case". The rule-standard audit flagged it as contested style naming no bug class.
- Cut "`describe()` labels use the exact identifier of the subject" as naming style naming no failure.

### Owned elsewhere

- Cut "co-locate unit tests with their respective components". The `codebase-layout` skill's test reference places a unit test beside its module.
- Cut "keep specs apart from their fixtures, page objects, and helpers inside `e2e/`", which the same reference owns.

### Merged or reworded

- Folded "place all Playwright tests within `e2e/`", "never place Playwright tests inside `src/`", and the scope bullet for a Vitest test driving a browser into one placement bullet.
- Merged "do not make real network calls in unit tests" into the MSW bullet.
- Merged the two suffix bullets into one.
- Reworded "use `userEvent` over synthetic events" and the accessible-query bullet to name what each source says the choice prevents.
