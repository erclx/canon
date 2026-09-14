# Candidate pages

Read when drafting arms for a finding. Skip it for a finding with no visible choice.

## Build from the app

- Dump the rendered markup of the surface under test from the built page, after it has loaded, into a JSON file in scratch. Strip scripts from the dump.
- Copy the built stylesheet and font files under `.canon/tmp/`, at the path the dumped markup links them from, so a candidate page renders with the stylesheet the app ships. Every arm then differs from the shipped page only by what the arm names.
- Trim a large dump to the part the finding needs, and keep the wrapper classes intact so layout rules keyed to them still resolve.
- Size each frame to the content width the finding names rather than the window width, since a container query reads the frame.
- Write copy an arm introduces with `write-human`, and take every other word from the dump.

## The page

- Generate the page with a short script, one per round, so a shared change is one edit and a rerun.
- Put a theme button on the page that flips the app's own theme switch on the root, rather than drawing each frame once per theme. Read `?arm=<id>&theme=<name>` to strip every other arm and the button for capture. Skip the button for an app that ships one theme.
- Print each frame's measurement under it from a script in the page, so the numbers the operator reads are the browser's.
- Write an index page linking one page per arm when an arm is a whole page or a route rather than a frame, with thumbnails copied beside it.
- Name anything the preview cannot reproduce, such as an asset whose colors follow the browser rather than the page's theme button, rather than fixing the page around it.

## Where this departs from draft-and-pick

- Capture into the walkthrough's own numbered evidence folder instead of the folder `draft-and-pick` Step 6 archives arms into, per `${CLAUDE_SKILL_DIR}/references/record.md`.
- Link the app's built stylesheet instead of inlining every asset. Lifted markup needs the real stylesheet, and an inlined copy is the drift this avoids.
- Keep `candidates.html` and never apply the winning arm. The walkthrough records and a build applies.
- Leave `.canon/tmp/<nn>-<slug>/` in place until the picks are built, and never delete the round's evidence folder.
