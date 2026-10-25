---
title: Component tests reference ledger
description: Sources for claude/skills/test-craft/references/component.md, one row per bullet
---

# Component tests reference ledger

The field is UI testing, where Testing Library and Kent C. Dodds's guidance carry how a rendered component is queried, driven, and waited on. Vitest and Playwright carry the real-browser runners. Each row cites the bullet's own inline link where the reference carries one.

## What belongs here

| Bullet                                 | Source                                                                                                                                                                                                                                        | Read       |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Every state a component shows          | [Vocke, The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html): in a UI test, "data should be presented to the user, the UI state should change as expected"                                              | 2026-10-24 |
| Every interaction that changes it      | [Vocke, The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html): "User input should trigger the right actions"                                                                                             | 2026-10-24 |
| Conditional rendering, keys, and focus | [Testing Library, user-event](https://testing-library.com/docs/user-event/intro): it "manipulates the DOM just like a user interaction in the browser would", and "wouldn't let a user click a hidden element or type in a disabled text box" | 2026-10-24 |
| Not layout, scroll, or motion          | [Vitest, Why Browser Mode](https://vitest.dev/guide/browser/why): jsdom and happy-dom "only simulate a browser environment and not an actual browser, which may result in some discrepancies"                                                 | 2026-10-24 |

## Render

| Bullet                               | Source                                                                                                                                                                                                                    | Read       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Real children                        | [Dodds, Write tests](https://kentcdodds.com/blog/write-tests): "When you mock something you're removing all confidence in the integration between what you're testing and what's being mocked."                           | 2026-10-24 |
| The network doubled at its edge      | [Mock Service Worker, Philosophy](https://mswjs.io/docs/philosophy): it intercepts "outgoing network traffic", which "means having zero changes to your code altogether"                                                  | 2026-10-24 |
| Props and fixtures through a factory | [Pryce, Test Data Builders](http://www.natpryce.com/articles/000714.html): a builder "Has "chainable" public methods for overriding the values in its instance variables", so a test spells only the values it depends on | 2026-10-24 |

## Query and act like a user

| Bullet                            | Source                                                                                                                                                                                                                                             | Read       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Role and name first, test id last | [Dodds, Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library): "Which query should I use?" lists "the queries you should attempt to use in the order you should attempt to use them" | 2026-10-24 |
| User events over synthetic ones   | [Dodds, Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library): user-event "provides several methods that resemble the user interactions more closely"                                | 2026-10-24 |
| Assert what the user perceives    | [Testing Library, Guiding Principles](https://testing-library.com/docs/guiding-principles): a test "should deal with DOM nodes rather than component instances"                                                                                    | 2026-10-24 |

## Wait on one condition

| Bullet                         | Source                                                                                                                                                                                                                                           | Read       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| One assertion inside each wait | [Dodds, Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library): "Advice: only put one assertion in a callback."                                                                     | 2026-10-24 |
| No side effect inside a wait   | [Dodds, Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library): the callback runs "a non-deterministic number of times", so "your side-effect could run multiple times!"            | 2026-10-24 |
| The query that waits           | [Dodds, Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library): "find* queries use waitFor under the hood), but the second is simpler and the error message you get will be better" | 2026-10-24 |

## When a simulated DOM cannot render it

| Bullet                          | Source                                                                                                                                                                                                                                                                                                  | Read       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Vitest browser mode             | [Vitest, Browser Mode](https://vitest.dev/guide/browser/): the feature "allows you to run your tests in the browser natively, providing access to browser globals like window and document"                                                                                                             | 2026-10-24 |
| Astro through its client module | [Astro, Testing](https://docs.astro.build/en/guides/testing/): "Use Astro’s getViteConfig() helper in your vitest.config.ts configuration file to set up Vitest with your Astro project’s settings", while [Vitest's component list](https://vitest.dev/guide/browser/component-testing) names no Astro | 2026-10-24 |
| Playwright component testing    | [Playwright, Components](https://playwright.dev/docs/test-components): "It is stable. Tests import test and expect from plain @playwright/test", and a user of the removed packages should "stay on Playwright 1.62 until you have followed the migration guide"                                        | 2026-10-24 |
