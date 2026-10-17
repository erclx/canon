---
title: Inventory
description: The route walk behind canon inventory, why it reports a listing rather than a verdict, and the focus reader's dependence on keyboard modality
---

# Inventory

## Overview

`canon inventory` walks every route a project declares and reports one computed property per element, grouped by the answer rather than by the component. The command surface and its refusal reasons live in `canon docs overview`. This entry holds why it is shaped the way it is.

Its first subject is the focus ring, which `governance/rules/ui/a11y.md` states three rules against with no existing measurement. The command is an instrument that answers across every route, distinct from a capture that shows one.

## Layout

- `src/inventory/` owns the config reader, the subject readers, the browser walk, and the grouping
- `src/browser/` owns what every browser-driving command needs before it can report a failure, shared with `src/demo/`
- A project declares its routes and the `focus` subject's query in `inventory.toml` at its root. This repository carries none, so the verb refuses with `no-config` here.

## Decisions

### Reader and query split

A subject splits its reader from its query because the two have different owners. The toolkit ships the reader and the project declares which elements it runs over in `inventory.toml`, so the walk answers to the target rather than to a selector nobody there chose.

A config carrying no subject refuses rather than falling back to a built-in query, since a default would make the toolkit the author of what a project measures.

### Refusals over empty listings

Every way the walk produces no rows is a refusal rather than an empty listing. No rows and one row read identically to anything counting them. The first says the query reached nothing, and the second says the site gives one consistent answer.

The refusals cover a missing config, a server nobody started, and a query matching nothing on any route.

### Rest against focus

The focus reader reports the difference between rest and focus, not the focused style alone. A card with a resting shadow computes a shadow either way, so reading only the focused state would report a ring on an element whose appearance never moves.

An element the browser refuses to focus is named as such rather than folded into the no-treatment row. A disabled control and a control with no ring are different findings with different remedies.

### Nothing gates on the listing

The value is seeing how many different answers a site gives, and a gate collapses that to one bit. The cost is a measure that can rot with nobody noticing, recorded here rather than closed.

A later row can compare the group count against a recorded baseline the way `canon/config/baseline.json` does for other measures. Building both at once would decide the baseline question with no data.

### Two of three focus rules

Only two of the three focus rules in `a11y.md` are measurable this way. The project-focus-ring rule and the `outline-none` rule are both readable off computed style across routes.

The 3:1 contrast rule needs the two colors and a source for the background.

## Gotchas

### Keyboard modality

A `:focus-visible` ring is the treatment a pointer never reveals, so the walk presses Tab once per route to enter keyboard modality before focusing anything programmatically. The press is `enterKeyboardModality` in `src/browser/engine.ts`, shared since `src/driver/probes/focus.ts` became its second call site.

- The press leaves one element focused, and reading its rest state while it holds focus reports no difference and hides its ring
- The reader blurs the active element before its loop and each element after its turn, so the first element in the tab order does not read as untreated
- A scripted `.focus()` on an untouched page matches `:focus-visible` on its own, but stops once a click sets pointer modality, so the press is unconditional

### Reader serialization

A subject reader is serialized to source and evaluated inside the page, so every helper it needs is declared in its own body. A reference to anything at module scope survives typechecking and throws once the page calls it.

### Test and route quirks

A test asserting the server-unreachable refusal needs a port the kernel handed out and then released. The engine blocks a low reserved port before it connects, which is a different failure.

A route answering 404 contributes zero elements rather than failing, so the per-route line in the report separates a page with no matching elements from one that is not being served.
