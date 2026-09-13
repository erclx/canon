---
title: Inventory
description: The route walk behind canon inventory, why it reports a listing rather than a verdict, and the focus reader's dependence on keyboard modality
---

# Inventory

## Overview

`canon inventory` walks every route a project declares and reports one computed property per element, grouped by the answer rather than by the component. The command surface and its refusal reasons live in `docs/agents/commands.md`. This entry holds why it is shaped the way it is.

Its first subject is the focus ring, which `governance/rules/ui/410-a11y.md` states three rules against and nothing measured before this. The feature came out of `.canon/tasks/v62.8-no-instrument-answers-across-every-route.md`, which separated an instrument answering across all routes from a capture showing one.

## Layout

- `src/inventory/` owns the config reader, the subject readers, the browser walk, and the grouping
- `src/browser/` owns what every browser-driving command needs before it can report a failure, shared with `src/demo/`
- `inventory.toml` at the project root declares this repository's own routes and the `focus` subject's query, pointed at the generated teach pages under `.canon/teach/`. Every route names a workspace under that untracked, per-operator tree, so a clone without it meets a `server-unreachable` refusal rather than a report. A lesson's filename moves whenever the generator rewrites it, which is a second way the same route goes stale.

## Decisions

A subject splits its reader from its query because the two have different owners. The toolkit ships the reader and the project declares which elements it runs over in `inventory.toml`, which is what keeps the walk answering to the target rather than to a selector nobody there chose. A config carrying no subject refuses rather than falling back to a built-in query, since a default would quietly make the toolkit the author of what a project measures.

Every way the walk produces no rows is a refusal rather than an empty listing. No rows and one row read identically to anything counting them, and the first says the query reached nothing while the second says the site gives one consistent answer. That covers a missing config, a server nobody started, and a query matching nothing on any route.

The focus reader reports the difference between rest and focus rather than the focused style alone. A card carrying a resting shadow computes a shadow either way, so reading only the focused state would report a ring on an element whose appearance never moves. An element the browser refuses to focus is named as such rather than folded into the no-treatment row, since a disabled control and a control with no ring are different findings with different remedies.

Nothing gates on the listing. The value is seeing how many different answers a site gives, and a gate collapses that to one bit. What it costs is a measure that can rot with nobody noticing, recorded here rather than closed: a later row can compare the group count against a recorded baseline the way `.claude/canon/baseline.json` already does for other measures, and building both at once decides the baseline question with no data to decide it from.

Only two of the three focus rules in `410-a11y.md` are measurable this way. The project-focus-ring rule and the `outline-none` rule are both readable off computed style across routes, while the 3:1 contrast rule needs the two colors and a source for what the background is, which is the same runtime-versus-token-table split `canon/context/cli/audits.md` records for the design audit.

## Gotchas

A `:focus-visible` ring is the treatment a pointer never reveals, so the walk presses Tab once per route to put the page in keyboard modality before anything is focused programmatically. The press is `enterKeyboardModality` in `src/browser/engine.ts` rather than a line here, since `src/driver/probes/focus.ts` became the second call site for it. That press leaves one element focused, and reading that element's rest state while it holds focus reports no difference and hides whatever ring it draws. The reader blurs the active element before its loop and blurs each element after its turn, which is what keeps the first element in the tab order from reading as untreated.

The modality only decides the reading once the page has been touched. A scripted `.focus()` on a page that has taken no pointer interaction matches `:focus-visible` on its own, so a walk arriving at a fresh route would read correctly without the press. It stops matching the moment a click sets pointer modality, which is why the press is unconditional rather than scoped to the routes that need it.

A subject reader is serialized to source and evaluated inside the page, so every helper it needs is declared in its own body. A reference to anything at module scope survives typechecking and throws once the page calls it.

A test asserting the server-unreachable refusal needs a port the kernel handed out and then released. A low reserved port is blocked by the engine before it connects, which is a different failure and correctly not that one.

A route that answers with a 404 contributes zero elements rather than failing, so the per-route line in the report is what separates a page that has no matching elements from one that is not being served.
