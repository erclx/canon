# Surface capture standards

## What a surface is

- Treat anything the project renders for a person as a surface, generated pages included.
- Skip a component the production build strips out, such as a dev-only switcher.

## When to capture

- Run the project's capture command against a preview server, never a dev server, after changing a surface. Report a project with none.
- Capture every theme the surface ships, and again after fixing a defect found.
- Add a case for every rendered state the change adds or alters, on a new surface or an already captured one. Proof is the default.
- Count a focus ring, an outline, a toast, a tooltip, a size change from server-written markup, and a state reachable only by interaction as visible states.
- Read your capture against the `canon:ui-checklist` boxes before opening the pull request, reporting a skill that does not resolve.

### The exemption

Only a change with no visible result in any reachable state is exempt, such as a keyboard order that moves no ring. A capture costs one command and a missing one costs a review round, so the worker never judges the exemption alone.

- State it in the pull request body as a line naming the path and why nothing shows.
- A reviewer accepts it by writing a ``- **Waived capture:** `<path>`: <reason>`` line in a review.
- A painted path with neither a case nor that line keeps the pull request in draft.

## When the fixture cannot reach a state

- Extend the drive fixture in the same branch when a box or a case needs a state it lacks, and commit the added state under a path the fixture declares, since the throwaway copy wipes anything else.
- Never record the missing state as a skip, since the next pull request meets the same fixture and skips again.
- State the setup inline when the project has no `canon/config/app-drive.toml`, since the drive there starts from the served root and a fixture file is not owed.

## What a capture covers

- Capture the full page, never a component in isolation.
- Capture a layout case at 320, the reflow floor in `a11y`, plus each breakpoint in the `## Layout` section of `DESIGN.md`, or at 320 alone when there is none.
- Capture resizable chrome at its narrowest and widest clamp, at the narrowest width keeping it persistent. Judge the content width beside it.
- Capture a state case at one width, driving states a first render cannot reach, such as an open menu.
- Add a surface's case with the surface, and remove it with the surface.

## What a moving change owes

- Verify a change that scrolls, snaps, or tracks the scroll with the input a person uses, at each width it is captured at. A scripted `scrollIntoView` only brings a target into view.
- Send the wheel in 100 px notches at two paces, spaced and in a burst, since a snap or scroll-linked page can stall at one pace and move at the other.
- Move the same surface with the keyboard, through the arrow keys and Page Down, since a surface the wheel moves and the keys cannot fails keyboard operation.
- Sample the motion at fixed steps across its range, reading the position after each notch or key, never only where it ends.
- Drive a touch or hover behavior in a touch session, since a resized desktop window keeps hover on and cannot fail a hover query.

## Sharing a capture

- Write a capture into a folder named `evidence`, which the pull request comment collects from.
- Commit a flagged case's evidence output and never the sweep, unless the project already commits the same comparison elsewhere.
- Commit a new evidence case only after two captures with no code change between them match byte for byte.
- Mask the smallest element holding a value that moves between runs, such as a clock, before the double capture.
- Name the variance in the pull request when masked outputs still differ, never re-running toward a match.
