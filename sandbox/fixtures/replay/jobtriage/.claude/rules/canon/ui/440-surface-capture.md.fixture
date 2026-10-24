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

- A surface is anything the project renders for a person to look at. A framework route is one. A page the project generates is another, whoever generates it.
- Judge a generated page by the same rule as a route. Reading its markup reports nothing about how it composes.
- A component the production build strips out is not a surface, such as a dev-only scenario switcher gated behind a build flag. The build removes it before anything renders, so no comparison exists to capture.

## When to capture

- Run the project's capture command after changing what a surface renders. Report it rather than proceeding silently when the project has none.
- Capture against a running preview server. Do not capture against a dev server.
- Capture every theme the surface ships. Do not capture the default theme alone.
- Capture again after fixing a defect a capture found. A repair inside a shared stylesheet can cancel a rule written earlier in the same file.

## What a capture covers

- Capture the full page at the viewport its case declares. Do not capture a component in isolation.
- Drive a state a screenshot cannot reach. An initial render reports nothing about a menu that opens, an answer that is chosen, or a rail that tracks scrolling.
- Add a case to the capture record when adding a surface.
- Remove a surface's case in the change that removes the surface.

## Sharing a capture

- Do not commit the sweep. It stays ignored.
- Commit a flagged case's evidence output so the pull request carries the comparison, rather than attaching it by hand.
- A project whose own established convention already commits that same comparison may route a flagged case's evidence there instead of a separate evidence folder. Only an established convention already committing the same comparison qualifies, not a preference for skipping a second folder.
- Commit an evidence case for the first time only after running the capture twice with no code change between the runs and confirming the two outputs are byte-identical.
- Recommitting an unbounded sweep on every run reaches a gigabyte of repository history inside a hundred merges. A small, committed evidence set is what a reviewer needs and what lets GitHub draw its own before-and-after comparison on the pull request.
- `git-pr` and `git-followup` maintain a comparison comment on the pull request automatically once a case is committed, so a reviewer never has to open Files Changed to see it.
