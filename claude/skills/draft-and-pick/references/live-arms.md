# Live app arms

Read when the surface under decision is a running app rather than a static mockup: the operator's request names a route or URL of the project's own app, or the decision is about a surface a build command serves. Skip it for a decision with nothing running to lift from, which stays on Step 2's default inlined path.

## Lift from the app

- Dump the rendered markup of the surface under decision from the built page, after it has loaded, into a file under `<dest>`. Strip scripts from the dump.
- Copy the built stylesheet and font files beside the page, at the path the dumped markup links them from, so a candidate page renders with the stylesheet the app ships. Every arm then differs from the shipped page only by what the arm names.
- Trim a large dump to the part the decision needs, and keep the wrapper classes intact so layout rules keyed to them still resolve.
- Size each frame to the content width the decision names rather than the window width, since a container query reads the frame.
- Write copy an arm introduces with `write-human`, and take every other word from the dump.

## The page

- Generate the page with a short script, one per round, so a shared change is one edit and a rerun.
- Put a theme button on the page that flips the app's own theme switch on the root, rather than drawing each frame once per theme. Read `?arm=<id>&theme=<name>` to strip every other arm and the button for capture. Skip the button for an app that ships one theme.
- Print each frame's measurement under it from a script in the page, so the numbers the operator reads are the browser's.
- Write an index page linking one page per arm when an arm is a whole page or a route rather than a frame, with thumbnails copied beside it.
- Name anything the preview cannot reproduce, such as an asset whose colors follow the browser rather than the page's theme button, rather than fixing the page around it.
