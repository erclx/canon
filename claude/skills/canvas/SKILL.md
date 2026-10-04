---
name: canvas
description: Drives the local design canvas, where pages hold HTML frames the operator sees, drags, selects, and edits in the browser. Starts the canvas when it is not running, confirms the live shell loads, makes pages and frames, edits a frame through its file, reads what the operator selected or restyled, captures finished frames, and carries a picked direction into the project's design document. Use when asked to "open the canvas", "put this on the canvas", "draw a frame for X", "change the one I selected", "what did I pick", "capture this frame", or "move that frame on the canvas". Do NOT use to trace reference images into design values, which is `sketch-design`, or to write the design document from code, which is `design-extract`.
---

# Canvas

Drive the canvas the operator is looking at. A page is a folder of HTML frames and a frame is one file, so a session draws by writing files and the operator sees each write land in the browser. The content format is fixed by `${CLAUDE_SKILL_DIR}/../../standards/canvas.md`. Read it before writing a frame.

Every verb below is `canon canvas`. Run `canon docs canvas` for the full verb reference, its records, and its refusals.

## Guards

- If `canon` is not on PATH, stop: `❌ canon CLI not found.`
- If `canon canvas --help` reports no such command, stop: `❌ The installed canon carries no canvas command. Update the CLI and re-run.`
- Write no frame before the canvas is serving and the shell has loaded. A frame nobody can see is a draft reported as delivered.
- Never present a frame as the project's design. The canvas is a drafting surface and the project's design document or wireframes hold what was decided.
- Never promise the canvas survives a lost checkout. Its folder is gitignored and nothing backs it up.

## Step 1: start the canvas and confirm the shell

Read the pages first, which also proves the verb resolves:

```bash
canon canvas list --json
```

The record carries `content`, the folder every page lives in. It sits at the main worktree root whichever worktree the session runs in, so write through that path rather than one composed from the current directory.

Start the server in the background unless the operator named an address that already answers, since it runs until interrupted. No verb reports a running server, and a second one is harmless, since it walks to the next free port and serves the same folder:

```bash
canon canvas serve --json
```

Read `url` off the record rather than composing one, since the server walks past a port already in use. Report the refusal and its `reason` when `ok` is false, and stop there.

Then fetch the printed address and check the shell itself, not a capture:

- The body is non-empty and carries a `<script` tag. An empty `200` means the shell failed to build, usually a dependency missing from the canvas tool's install, and every capture still passes because captures go through the frame route alone. Report it as a blank shell and stop.
- `<url>/api/pages` answers with JSON listing the pages.

Hand the operator the address as a markdown link carrying the URL as its text and its target.

## Step 2: make pages and frames

- Add a page for each decision being drafted: `canon canvas page add <page> --json`.
- Add each frame through the verb, which writes the starting file and its box in one locked step: `canon canvas frame add <page> <frame> --width <px> --height <px> --json`. Give the width the frame should render at, since a capture and the canvas both render at it.
- Lay frames out with `canon canvas frame move <page> <frame> --x <px> --y <px> --json` rather than writing `layout.json` by hand, since the operator's drags write the same file under a lock.
- Name pages and frames for what they hold, such as `pricing` and `pricing-dense`, so the operator can say which one by name.

## Step 3: edit a frame through its file

Write the frame's whole document to the `path` the add verb reported. The open canvas reloads the frame when its file changes.

Mark the frame before the first write, so the operator sees which frame is being worked on before anything lands, and clear the mark once the edits to it are done:

```bash
canon canvas editing <page>/<frame> --json
canon canvas editing <page>/<frame> --done --json
```

- A mark lapses after five minutes, so mark the frame again during a longer edit.
- Clear it on every exit from the edit, including one that stopped on a refusal. Clearing a frame that holds no mark succeeds.
- When `canon canvas editing --help` reports no such command, the installed CLI predates the mark, so go on without it rather than stopping.

- From a linked worktree, `Edit` and `Write` refuse a main-root path. Write the whole file through one plain `Bash` heredoc instead, the route `session-worktree` states for a main-root write, and never take the redirect to a worktree copy.
- Change one property of one element with `canon canvas edit <page>/<frame> --element <index> --set <property>=<value> --json` when the set it accepts covers the change, since it leaves every other byte as it was.
- Use the project's custom properties for every value the token stylesheet defines. The record from `serve` names the token source under `tokens`, and a `none` source means frames render unstyled, so say so rather than inventing values to cover it.

## Step 4: read what the operator pointed at

Read the selection when the operator says "this one", "the selected frame", or "that button":

```bash
canon canvas selection --json
```

- `selection: null` means nothing is selected or the selected frame is gone. Ask which one rather than guessing.
- An `element` carrying `stale: true` was picked against an earlier version of the file, so its `index` may now land on a different element. Treat the pick as unknown and ask the operator to pick again, rather than acting on the index or matching its `tag` and `text` by eye.
- A fresh `element` gives the `index` that `canvas edit` takes.

## Step 5: respect the operator's inspector edits

The operator restyles elements from the inspector, and each edit lands as inline `style` on the element. Inline style beats a class, so a class change made afterwards does not show.

- Read the frame's inline `style` attributes before restyling anything in it.
- Keep an inline property the operator set unless the change replaces it, and drop it, through `canvas edit` with an empty value or by rewriting the file, when it does.
- Say which operator edits were kept and which were dropped.

## Step 6: capture finished work

- Capture a frame once it is finished: `canon canvas capture <page>/<frame> --json`. Each PNG is the frame's whole document, so its height follows the content rather than the box.
- Capture a whole page once its frames are finished: `canon canvas capture <page> --composite --json`. The image shows each frame clipped to its box at its layout position.
- Capture once per finished frame or page, not after every edit. The live canvas is the working view, and a capture is the record handed on.
- Read each `path` off the record rather than composing one.
- A capture refused because a font is not installed names the family it read off the frame's text. Set that text's `font-family` to a named family the machine has, never a generic keyword such as `sans-serif`, and capture again, rather than reporting the frame as captured.

## Step 7: carry a picked direction back

When the operator picks a frame, the decision leaves the canvas.

- Carry visual values, being color, type, spacing, and radius, into the project's design document, through the skill that owns it. Carry structure and layout into the project's wireframes.
- Name the frame the decision came from in the reply, and leave the frame on the canvas until the operator clears it.
- Never cite a frame path from a tracked file. The folder is gitignored, so the citation resolves on this machine alone.

## Output

```plaintext
✅ Canvas: <url the serve verb reported>
Page:     <page>, <n> frames
Selected: <page>/<frame>, element <index>, or none, or stale
Capture:  <path of each capture written>
Carried:  <the design document or wireframe the pick went to, or not yet>
```

Write the canvas line's URL as a markdown link. Omit the capture line when nothing was captured and the carried line when no direction was picked. Emit every path from the project root.
