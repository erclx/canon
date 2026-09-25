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

- Capture the full page. Do not capture a component in isolation.
- Declare the widths a layout case captures. Always include 320, the reflow floor from the reflow criterion in `410-a11y`, then add each breakpoint bucket the project writes rules for, read from the `## Layout` section of `DESIGN.md`.
- Fall back to the 320 floor alone when the project has no `DESIGN.md` or its record carries no `## Layout` section. Do not impose another project's breakpoints.
- Add a layout case at each bound when a surface renders persistent chrome a person can resize, such as a draggable sidebar or a split pane, one with the chrome at its narrowest and one at its widest. Take both at the narrowest declared width where the chrome stays persistent rather than collapsing, since a frame where it has turned into an overlay shows none of the width it takes.
- Read those bounds from the code that clamps the chrome, since `## Layout` has no slot for them. Judge each frame by the content width left beside the chrome rather than by the window width, against the 320 floor `410-a11y` holds for that region.
- Apply the declaration to a case that covers layout only. A case driving a menu open or an answer chosen tests a state, so it takes one width rather than the full set.
- Read a capture at 320 as proof that a frame was taken there, not that the page reflows correctly. The criterion is stated in `410-a11y` and nothing here enforces it.
- Write the capture into a folder named `evidence`. The image is collected for the pull request comment when any segment of its path is literally `evidence` and its filename carries an image extension, so the folder name is fixed and its position in the tree is the project's own.
- Several `evidence/` folders in one project is the ordinary shape rather than a problem to consolidate. One per surface is how a project with more than one rendered surface ends up.
- Drive a state a screenshot cannot reach. An initial render reports nothing about a menu that opens, an answer that is chosen, or a rail that tracks scrolling.
- Add a case to the capture record when adding a surface.
- Remove a surface's case in the change that removes the surface.

## Sharing a capture

- Do not commit the sweep. It stays ignored.
- Commit a flagged case's evidence output so the pull request carries the comparison, rather than attaching it by hand.
- A project whose own established convention already commits that same comparison may route a flagged case's evidence there instead of a separate evidence folder. Only an established convention already committing the same comparison qualifies, not a preference for skipping a second folder.
- Commit an evidence case for the first time only after running the capture twice with no code change between the runs and confirming the two outputs are byte-identical.
- Mask the element carrying a value that moves between runs, such as an elapsed-time counter, a clock, or a relative date, in the state's capture case before the double capture, so the check still runs on everything else in the frame. Mask the smallest element holding the value, never the state.
- Do not commit the state as evidence when the masked outputs still differ, which happens when the value's width reflows its neighbors. Name the variance in the pull request instead, and never re-run toward a match.
- Recommitting an unbounded sweep on every run reaches a gigabyte of repository history inside a hundred merges. A small, committed evidence set is what a reviewer needs and what lets GitHub draw its own before-and-after comparison on the pull request.
- `git-pr` and `git-followup` maintain a comparison comment on the pull request automatically once a case is committed, so a reviewer never has to open Files Changed to see it.
