---
title: Component tests
description: Render with real children, query by role, drive with user events, wait on one condition at a time, and move to a real-browser runner for what a simulated DOM cannot render
---

# Component tests

Read this before writing the first test at the component layer. A component's logic is its rendered behavior, so the lowest layer that catches a break in a loading state, an interaction, or a validation message is a rendered component test rather than a browser run across the whole site. Kent C. Dodds's testing trophy makes this the widest band for UI code ([Write tests](https://kentcdodds.com/blog/write-tests)), on the principle Testing Library states: "The more your tests resemble the way your software is used, the more confidence they can give you" ([guiding principles](https://testing-library.com/docs/guiding-principles)).

## What belongs here

- Every state a component can show: loading, empty, error, populated, disabled.
- Every interaction that changes what it shows: a toggle, a filter, a form's validation and submit.
- Conditional rendering, keyboard handling inside the component, and focus moving where it should.
- Not a journey across routes, and not layout, scroll, or motion a simulated DOM does not compute. Those go to a real-browser component test below, or to end to end.

## Render

- Render with real children. Stubbing a child hides the break at the seam the user actually meets.
- Double the network at its edge with a request interceptor rather than mocking the data hook, so the component's own loading and error handling runs.
- Build the props or the fixture through a factory, keeping the values this case depends on visible.

## Query and act like a user

- Query by role and accessible name first, then by label, then by visible text. Reach for a test id only when nothing a user perceives identifies the element ([common mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)).
- Drive interaction through the user-event API rather than firing synthetic events, so focus, pointer, and keyboard sequences run as a browser would run them ([same](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)).
- Assert what the user perceives: text, role, state, focus. Never assert a class name, a hook's return value, or an internal state variable.

## Wait on one condition

- Put one assertion inside each wait. A wait holding several retries on the first and reports the wrong failure ([common mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)).
- Never put a side effect inside a wait. It runs once per retry.
- Prefer the query that waits over a wait wrapping a query that does not.

## When a simulated DOM cannot render it

A simulated DOM computes no layout, no scroll position, and no animation frame. When the behavior under test is one of those, move to a runner that renders the component in a real browser rather than promoting the test to end to end.

- Vitest browser mode runs tests "in the browser natively", with Playwright or WebdriverIO as the provider, and lists React, Vue, Svelte, Angular, Lit, Preact, and Qwik. Astro is not on the list ([Vitest browser mode](https://vitest.dev/guide/browser/)). For a static site, test the client module that drives the behavior against a fixture DOM here.
- Playwright component testing is stable in plain `@playwright/test` through a mount fixture, and "if your dev server can render it, Playwright can test it" ([Playwright component testing](https://playwright.dev/docs/test-components)). The experimental `-ct-*` packages were removed after 1.62.

Either runs in a real browser without navigating the whole site, which keeps the test at the component's cost while observing what only a browser computes.
