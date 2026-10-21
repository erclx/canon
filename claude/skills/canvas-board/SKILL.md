---
name: canvas-board
description: Drives the local design canvas, where pages hold HTML frames the operator sees, drags, selects, and edits in the browser. Starts the canvas when it is not running, confirms the live shell loads, makes pages and frames, edits a frame through its file, reads what the operator selected or restyled, captures finished frames, and hands a picked frame to `design-record`. Use when asked to "open the canvas", "put this on the canvas", "draw a frame for X", "change the one I selected", "what did I pick", "capture this frame", or "move that frame on the canvas". Do NOT use to draft candidates for a taste decision, which is `pick-by-eye`.
metadata:
  family: decide
---

# Canvas board

Drive the canvas the operator is looking at. A page is a folder of HTML frames and a frame is one file, so a session draws by writing files and the operator sees each write land in the browser. The content format is fixed by `${CLAUDE_SKILL_DIR}/references/canvas.md`. Read it before writing a frame.

Every verb below is `canon canvas`. Run `canon canvas --help` for the verbs and their refusals, and read `${CLAUDE_SKILL_DIR}/references/canvas.md` for the content format.

## Guards

- If `canon` is not on PATH, stop: `❌ canon CLI not found.`
- If `canon canvas --help` reports no such command, stop: `❌ The installed canon carries no canvas command. Update the CLI and re-run.`
- Write no frame before the canvas is serving and the shell has loaded. A frame nobody can see is a draft reported as delivered.
- Never present a frame as the project's design. The canvas is a drafting surface and the project's design record holds what was decided.
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

### Check the shell

Fetch the printed address and check the shell itself, not a capture, since every capture goes through the frame route alone and passes on a blank shell.

- The body is non-empty and carries a `<script` tag. An empty `200` means the shell failed to build, usually a missing dependency, so report a blank shell and stop.
- `<url>/api/pages` answers with JSON listing the pages.

Hand the operator the address as a markdown link carrying the URL as its text and its target.

## Step 2: make pages and frames

- Add a page for each decision being drafted: `canon canvas page add <page> --json`.
- Follow the house style in `${CLAUDE_SKILL_DIR}/references/canvas.md` before drafting an explanation frame.
- Add each frame with `canon canvas frame add <page> <frame> --width <px> --height <px> --json`, which writes the file and its box in one locked step

Give each frame the width it should render at, since a capture and the canvas both render at it. The verb places the frame after the last one, and a position the operator asks for goes through `frame move`.

### Layout and naming

Lay frames out through the verbs rather than by hand, since the operator's drags write the same `layout.json` under a lock.

- Move a frame with `canon canvas frame move <page> <frame> --x <px> --y <px> --json`
- Name pages and frames for what they hold, such as `pricing` and `pricing-dense`, so the operator can say which one by name.
- After an insert or a resize, re-lay the page with `canon canvas arrange <page> --json`. It keeps dragged rows, sets the standard gap, and drops entries whose file is gone.
- Run `arrange --check` to report without writing

## Step 3: edit a frame through its file

Write the frame's whole document to the `path` the add verb reported. The open canvas reloads the frame when its file changes.

- From a linked worktree, `Edit` and `Write` refuse a main-root path. Write the whole file through one plain `Bash` heredoc, the route `session-worktree` states, never a worktree copy.
- Change one property with `canon canvas edit <page>/<frame> --element <index> --set <property>=<value> --json` when its set covers the change, since it leaves every other byte as it was
- Use the project's custom properties for every value the token stylesheet defines. The `serve` record names the source under `tokens`, and `none` means frames render unstyled, so say so.

### Fit the box

Fit the box to the content once the write lands, with `canon canvas fit <page>/<frame> --json`, and read each row's `wide` and `font`.

- A `wide` frame needs its box widened, which fit never does
- A `font` frame names a family the canvas does not serve, so set its text to a served face and fit again
- A fit that grew a frame leaves the rows below overlapped until `canvas arrange` runs

### Mark the frame

Mark the frame before the first write, so the operator sees which frame is being worked on before anything lands, and clear the mark once the edits to it are done:

```bash
canon canvas editing <page>/<frame> --json
canon canvas editing <page>/<frame> --done --json
```

- A mark lapses after five minutes, so mark the frame again during a longer edit.
- Clear it on every exit from the edit, including one that stopped on a refusal. Clearing a frame that holds no mark succeeds.
- On `unknown command 'editing'`, the CLI predates the mark, so go on without it. Never run `canvas edit` in its place, since that verb writes the frame.

## Step 4: read what the operator pointed at

Read the selection when the operator says "this one", "the selected frame", or "that button":

```bash
canon canvas selection --json
```

- `selection: null` means nothing is selected or the selected frame is gone. Ask which one rather than guessing.
- An `element` carrying `stale: true` was picked against an earlier file, so its `index` may land elsewhere. Ask the operator to pick again rather than matching its `tag` and `text` by eye.
- A fresh `element` gives the `index` that `canvas edit` takes.

## Step 5: respect the operator's inspector edits

The operator restyles elements from the inspector, and each edit lands as inline `style` on the element. Inline style beats a class, so a class change made afterwards does not show.

- Read the frame's inline `style` attributes before restyling anything in it.
- Keep an inline property the operator set unless the change replaces it, and drop it, through `canvas edit` with an empty value or by rewriting the file, when it does.
- Say which operator edits were kept and which were dropped.

## Step 6: capture finished work

Capture once per finished frame or page, not after every edit. The live canvas is the working view, and a capture is the record handed on.

- Capture a frame with `canon canvas capture <page>/<frame> --json`. Each PNG is the whole document, so its height follows the content rather than the box.
- Capture a page with `canon canvas capture <page> --composite --json`, which shows each frame clipped to its box at its layout position
- Read each `path` off the record rather than composing one.

A capture refused because a font is not installed names the family it read off the frame's text. Set that text's `font-family` to a named family the machine has, never a generic keyword such as `sans-serif`, and capture again rather than reporting the frame as captured.

## Step 7: hand a picked frame on

When the operator picks a frame, the decision leaves the canvas. Hand it to `canon:design-record`, which lands the frame in the project's reference folder and carries its values into the design document. Report it rather than proceeding silently when that skill does not resolve.

- Name the page and frame the decision came from in the handoff and the reply, and leave the frame on the canvas until the operator clears it
- Name the frame in the plan that builds a picked layout, since the layout reaches code through that plan
- Never cite a frame path from a tracked file. The folder is gitignored, so the citation resolves on this machine alone.

## Output

```plaintext
✅ Canvas: <url the serve verb reported>
Page:     <page>, <n> frames
Selected: <page>/<frame>, element <index>, or none, or stale
Capture:  <path of each capture written>
Handed:   <the frame handed to design-record, the plan that cites it, or not yet>
```

Write the canvas line's URL as a markdown link. Omit the capture line when nothing was captured and the handed line when no frame was picked. Emit every path from the project root.
