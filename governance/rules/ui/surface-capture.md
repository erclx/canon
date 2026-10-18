---
description: Require a capture against a running preview after a rendered surface changes
paths:
  - '**/routes/**/*.{tsx,jsx,vue,svelte,astro}'
  - '**/pages/**/*.{tsx,jsx,vue,svelte,astro}'
  - '**/app/**/page.{tsx,jsx}'
  - '**/components/**/*.{tsx,jsx,vue,svelte,astro}'
  - '**/*.html'
---

# Surface capture standards

## What a surface is

- Treat anything the project renders for a person as a surface, a generated page as much as a route.
- Skip a component the production build strips out, such as a dev-only switcher.

## When to capture

- Run the project's capture command against a preview server, never a dev server, after changing a surface. Report it when the project has none.
- Capture every theme the surface ships, and again after fixing a defect a capture found.

## What a capture covers

- Capture the full page, never a component in isolation.
- Capture a layout case at 320, the reflow floor in `a11y`, plus each breakpoint in the `## Layout` section of `DESIGN.md`, or at 320 alone when there is none.
- Capture resizable chrome at its narrowest and widest clamp, at the narrowest width keeping it persistent. Judge the content width beside it.
- Capture a state case at one width rather than the full set.
- Drive a state an initial render cannot reach, such as an open menu or a rail tracking scroll.
- Add a surface's case with the surface, and remove it with the surface.

## Sharing a capture

- Write a capture into a folder named `evidence`, which the pull request comment collects from.
- Commit a flagged case's evidence output and never the sweep, unless the project already commits the same comparison elsewhere.
- Commit a new evidence case only after two captures with no code change between them match byte for byte.
- Mask the smallest element holding a value that moves between runs, such as a clock, before the double capture.
- Name the variance in the pull request when masked outputs still differ, never re-running toward a match.
