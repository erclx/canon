---
title: Inventory
description: The route walk behind canon inventory, the subject readers it runs, and the focus reader's dependence on keyboard modality
---

# Inventory

## Overview

`canon inventory` walks every route a project declares and reports one computed property per element, grouped by the answer rather than by the component. Its one subject today is the focus ring, which `governance/rules/ui/keyboard.md` states rules against. The command reports a listing and gates nothing. Start from `canon inventory --help`.

## Layout

### `src/inventory/`

Reads the project's config, runs a subject's reader over each route in the browser, and groups the rows.

- A project declares its routes and each subject's query in `inventory.toml` at its root, and this repository carries none, so the verb refuses with `no-config` here
- The toolkit ships the reader and the project ships the query, and a config naming no subject refuses rather than falling back to a built-in query
- Every way the walk yields no rows is a refusal, being a missing config, a server nobody started, or a query matching nothing on any route
- The focus reader reports rest against focus rather than the focused style alone, and names an element the browser refuses to focus apart from one with no ring
- A route answering 404 contributes zero elements, so the per-route line separates an empty page from one not being served

### Other folders

The browser helpers and the step driver sit beside the walk.

- `src/browser/` owns the engine helpers every browser-driving command needs
- `src/driver/` owns `canon drive`, which runs a plan of steps and probes against a running page for `pick-by-eye` and `review-ui`

## Gotchas

- A `:focus-visible` ring only shows in keyboard modality, so the walk presses Tab once per route and the reader blurs that focused element before it reads rest state
- A subject reader is serialized to source and evaluated in the page, so a helper declared at module scope typechecks and then throws there
- Only two of the three `keyboard.md` focus rules are measurable from computed style, since the 3:1 contrast rule needs a background source the walk does not have
- The axe bundle sets `window.axe`, `doT`, and `_encodeHTML` as it loads, so the `axe` probe restores only what that load changed, and a default run leaves it out
- A test for the server-unreachable refusal needs a port the kernel handed out and released, because a low reserved port fails in the engine first
