# Live app arms

Read when the surface under decision is a running app rather than a static mockup: the operator's request names a route or URL of the project's own app, or the decision is about a surface a build command serves. Skip it for a decision with nothing running to lift from, which stays on Step 2's default inlined path.

## Lift from the app

- Dump the rendered markup of the surface under decision from the built page, after it has loaded, into a scratch file the run reads from. Strip scripts from the dump.
- Copy the built stylesheet and fonts into the page folder or the project's `assets/`, since a frame resolves nothing else. Each arm then differs from the shipped page only in what it names.
- Trim a large dump to the part the decision needs, and keep the wrapper classes intact so layout rules keyed to them still resolve.
- Set each frame's `--width` to the content width the decision names rather than the window width, since a container query reads the frame.
- Write copy an arm introduces with `write-human`, and take every other word from the dump.

## The frames

- Generate the frames with a short script, one per round, so a shared change is one edit and a rerun.
- Leave the theme to the board toggle, which sets the app's own `data-theme` switch on every frame's root. Name the attribute the stylesheet reads where it differs, as the toggle sets that one alone.
- Print each frame's measurement under it from a script in the frame, so the numbers the operator reads are the browser's.
- Draw an arm that is a whole page or a route as one frame at that page's width, so it still sits beside the other arms on the round's page.
- Name anything the board cannot reproduce, such as an asset whose colors follow the browser rather than the frame's theme, rather than fixing the frame around it.
