---
title: End to end tests reference ledger
description: Sources for claude/skills/test-craft/references/e2e.md, one row per bullet
---

# End to end tests reference ledger

The field is browser test automation. Playwright's own documentation carries the runner rules, at the version the reference states, and Ham Vocke's pyramid carries which journeys earn a browser run. Each row cites the bullet's own inline link where the reference carries one.

The two worked failures report what one project's suite did, so each of their rows is a house choice naming the failure the incident shows rather than an outside citation.

## What earns a browser run

| Bullet                               | Source                                                                                                                                                                                                                                    | Read       |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A journey the product cannot lose    | [Vocke, The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html): "your most valuable customer journey could be a user searching for a product, putting it in the shopping basket and doing a checkout" | 2026-10-24 |
| What only a real browser computes    | [Vitest, Why Browser Mode](https://vitest.dev/guide/browser/why): "To achieve the highest level of confidence in our tests, it's crucial to test in a real browser environment."                                                          | 2026-10-24 |
| Not a state a component test reaches | [Vocke, The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html): end-to-end tests "are notoriously flaky and often fail for unexpected and unforeseeable reasons"                                      | 2026-10-24 |
| Not copy                             | [obra/superpowers, Writing Good Tests](https://github.com/obra/superpowers/blob/5bf4e78/skills/test-driven-development/writing-good-tests.md): a test pinning "exact message wording" "fires on redesign and sleeps through bugs"         | 2026-10-24 |

## Settle on conditions

| Bullet                                 | Source                                                                                                                                                                                                                                                                           | Read       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Web-first assertions                   | [Playwright, Best Practices](https://playwright.dev/docs/best-practices): "By using web first assertions Playwright will wait until the expected condition is met."                                                                                                              | 2026-10-24 |
| Actionability waits, a read does not   | [Playwright, Actionability](https://playwright.dev/docs/actionability): an element is "Stable , as in not animating or completed animation", while with "isVisible() the test won't wait a single second", per [Best Practices](https://playwright.dev/docs/best-practices)      | 2026-10-24 |
| No fixed pause for a condition         | [Fowler, Eradicating Non-Determinism in Tests](https://martinfowler.com/articles/nonDeterminism.html): "Never use bare sleeps to wait for asynchonous responses: use a callback or polling.", typo as published                                                                  | 2026-10-24 |
| A smooth scroll settles on `scrollend` | [MDN, Element: scrollend event](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollend_event): "The scrollend event fires when element scrolling has completed." The stillness fallback is a House choice: a target already in view never scrolls, so no event comes | 2026-10-24 |

## Motion off by default

| Bullet                                    | Source                                                                                                                                                                                                                                                                        | Read       |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Reduced unless the test asserts motion    | [Playwright, Browser](https://playwright.dev/docs/api/class-browser#browser-new-context): `reducedMotion` "Emulates 'prefers-reduced-motion' media feature", and a test opts back in through `page.emulateMedia()`                                                            | 2026-10-24 |
| Set once in `use.contextOptions`          | [Playwright, Browser](https://playwright.dev/docs/api/class-browser#browser-new-context): `reducedMotion` "Defaults to 'no-preference'", and [TestOptions](https://playwright.dev/docs/api/class-testoptions) shows `use : { contextOptions : { reducedMotion : 'reduce' } }` | 2026-10-24 |
| A top-level `use.reducedMotion` from 1.50 | [Playwright, TestOptions](https://playwright.dev/docs/api/class-testoptions): `testOptions.reducedMotion` was added in Playwright 1.50 and "Emulates 'prefers-reduced-motion' media feature", with `use : { reducedMotion : 'reduce' }` as its usage                          | 2026-10-25 |

## Isolation and speed

| Bullet                              | Source                                                                                                                                                                                                                                                  | Read       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Every test its own state            | [Playwright, Isolation](https://playwright.dev/docs/browser-contexts): "Tests written with Playwright execute in isolated clean-slate environments called browser contexts."                                                                            | 2026-10-24 |
| Workers and sharding over cut waits | [Playwright, Best Practices](https://playwright.dev/docs/best-practices): "Playwright runs tests in parallel by default", and "Playwright can shard a test suite, so that it can be executed on multiple machines"                                      | 2026-10-24 |
| A suite failing as workers rise     | House choice: an assertion that passes on one worker and fails on four depends on machine load, and no settle at that layer removes the dependence                                                                                                      | 2026-10-24 |
| A trace on the first retry          | [Playwright, Best Practices](https://playwright.dev/docs/best-practices): traces "are set to run on CI on the first retry of a failed test. We don't recommend setting this to on so that traces are run on every test as it's very performance heavy." | 2026-10-24 |
| Count the cost before adding a test | House choice: a test's runtime multiplies by every engine and every push, so a suite grown one cheap-looking test at a time is what makes the gate slow                                                                                                 | 2026-10-24 |

## Two worked failures

| Bullet                                   | Source                                                                                                                                                               | Read       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| A copy edit was a decision, not a bug    | House choice: an assertion on exact wording in a browser run is a change detector, failing every engine on an edit nobody would call a bug                           | 2026-10-24 |
| The copy belonged at unit                | House choice: a copy assertion run in a browser holds a deploy on every wording change, where a unit test beside the copy fails once and fast                        | 2026-10-24 |
| The settle was right and the layer wrong | House choice: an assertion whose result depends on CI load keeps failing at the layer where load decides it, however correct its settle                              | 2026-10-24 |
| The focus behavior moves down a layer    | House choice: a focus assertion on the whole-site run flakes its file and skips a deploy, where a real-browser component test observes focus without the site's load | 2026-10-24 |
