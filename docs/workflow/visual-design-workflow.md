---
title: Visual design workflow
description: How canon plans, builds, and reviews a UI, from the design reference a plan cites to the browser pass that holds a pull request open
category: Workflow
---

# Visual design workflow

Canon runs a UI feature through one loop. A plan cites the design, a worker builds against it and captures what it painted, and two independent reviews check the result. A project with no graphical design tool runs all of it, since the design lives in prose and in tracked frames.

## Plan

`canon:plan-feature` reads `canon/DESIGN.md` and `canon/design/index.md` before it places a UI change. It loads `canon:design-taste`, which decides the layer order a surface is designed in, the coherence locks that keep it consistent, and the defaults a model reaches for that the surface should reach past.

- The plan carries a `## Design references` section naming the accepted design for each surface it changes, or `None identified.` when there is none.
- A design becomes a reference through `canon:design-record`, which lands an accepted pick in `canon/design/` and carries its values into `canon/DESIGN.md`.

## Build

The worker opens each cited reference, light and dark, before its first edit to that surface. It takes sizes, spacing, and colors from the frame HTML rather than the image, and reports a reference that does not resolve instead of building without it.

- The ui rules fire on the files the worker edits. They cover design taste, the design reference, accessibility, input, motion, forms, copy, and links.
- The `surface-capture` rule has the worker capture the full page in every theme the surface ships, against a preview server and never a dev server.
- It sets the widths too, being 320 plus each breakpoint in `canon/DESIGN.md` for a layout case, and one width for a state case.

## Self-check

Before the pull request opens, the worker runs two checks.

- `canon:ui-checklist` writes the boxes a reviewer reads beside the captures. Each box is one observable behavior, and a box that needs eyes carries a `(taste)` mark.
- `canon:pr-evidence` posts the captures and the checklist on the pull request as one comment, which the reviews read.

`canon drive <url> <run>` covers states a first render cannot reach. A run file walks a page through named interactions and measures each state, with three probes:

- `focus` reads where keyboard focus lands and whether it shows
- `details` reads disclosure state
- `axe` runs the accessibility engine

Run `canon drive --help` for the step kinds and the run file shape.

## Review

Two reviews run beside each other and finish on their own clocks.

- `canon:review-pr` reads the code and the stills in the evidence comment, and posts under `## Review`.
- `canon:review-ui` never reads the diff. It drives each checklist box in the running app through the pinned `@playwright/cli` and posts under `## UI review`.
- Every box gets one verdict, being pass, fail, needs eyes, or not driven.

After the boxes, `review-ui` sweeps every route they reached:

- console errors on each route
- sideways overflow at each width a box named
- the `focus`, `details`, and `axe` probes through `canon drive`

## What holds a review open

A UI review stays open while the branch owes a fix. Three things owe one:

- a failed box
- a sweep finding, being a console error, an overflow, or an axe violation of a gated class
- a box the page kept the pass from driving

Two kinds of result report without holding the review open.

- A taste box needs eyes, so the pass captures both themes and leaves the call to you.
- Every other probe result, and every axe `incomplete`, is a reading to confirm, since each probe carries a known class of false finding.

The gated axe classes are contrast, target size, accessible names, labels, alt text, document title and language, valid ARIA, and nested interactive controls. The list moves when a rule produces a false finding, so this page names classes only. `canon drive --help` and the `review-ui` skill carry the current list.

A close posts as `## UI review closed`. The reviewers lift the draft mark on their close, and you merge.

## Design authoring

Most projects author design in the loop above and need nothing more. Start with `canon:pick-by-eye`, which drafts candidates as frames on a [Frameboard](https://www.npmjs.com/package/frameboard) board and takes your pick, then record the pick with `canon:design-record`. `canon:design-identity` drafts a logo mark and social card the same way.

A graphical tool earns its place when design is the product, a designer owns it, and it changes more often than code. Then the tool is the source of truth, and `canon/DESIGN.md` carries a top note naming the upstream project.

- Figma with the official [Figma Dev Mode MCP](https://www.figma.com/blog/introducing-claude-code-to-figma/), for a team already on Figma. It syncs both ways and captures a running UI into editable frames.
- [Claude Design](../../wiki/claude/design.md) with its Claude Code handoff bundle, for a team without Figma. The handoff is one-way.

The loop above runs unchanged on either, with the tool's export standing in for the pick.

For the skills by moment, see the [skill map](skill-map.md).
