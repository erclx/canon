---
name: design-record
description: Keeps the project's design reference folder at `canon/design/`, the accepted frames a build matches. Sets the folder up, lands a picked design through the project's design sync, keeps the index, and redraws or retires a reference when its surface changes. Use when asked to "add a design reference", "land this pick", "set up canon/design", "update the design index", "redraw the reference for X", or "remove the reference for X". Do NOT use to draft candidates or take a pick, which is `pick-by-eye`, to draw frames on the canvas, which is `canvas-board`, or to judge a design, which is `design-taste`.
metadata:
  family: ship
---

# Design record

Keep the record of what the project's design is. The reference folder holds the accepted frames, and `${CLAUDE_SKILL_DIR}/references/folder.md` fixes its groups, file names, and index. Read it before writing anything under `canon/design/`.

## Guards

- Write no reference file by hand, whether a copy, an edit, or a delete. The project's design sync writes the frames, so a hand-written file drifts from the frame it claims to show.
- Never land a candidate the operator has not picked. The folder holds accepted designs, and a draft lives on the canvas.

## Step 1: read the record

Read `canon/design/index.md` from the project root, and list the group folders beside it.

- A missing folder or index sends the run to Step 2 before anything lands
- An index carrying a file list or a canvas mapping is an older shape. Leave its rows in place, add new rows in the form `folder.md` gives, and say the index predates the standard.

## Step 2: set up the folder

Skip this step when `canon/design/index.md` exists, even as a stub, since a stub the project's stack seeded is the setup.

1. Write `canon/design/index.md` from the template in `folder.md`, with one row per group the first pick needs.
2. Leave the group folders to the sync, since git tracks no empty folder and the sync creates each one as it writes.

## Step 3: find the project's design sync

Read the project's scripts, such as the `scripts` block of `package.json`, for the command that writes frames into `canon/design/`. Run its `--help` when it offers one, for its mapping file and its check.

Capture no frame in the sync's place. When no sync resolves, stop: `❌ No design sync found. canon/design/ is written by the project's design sync, so add one or name the command, then re-run.`

## Step 4: land a pick

When the pick lands relative to the build is the design-reference rule's call, so follow it rather than choosing here.

1. Name the group the surface belongs to, by where a user meets it in the app, per `folder.md`.
2. Add or update the group's index row before running the sync, naming the code paths the surface governs and the states its frames show.
3. Add the surface to the sync's mapping file, in the form the sync's own help gives.
4. Run the sync, then its check, and report a missing or stray file the check names.
5. Open each written PNG, light and dark, before reporting it landed, since a frame captured blank or in one theme passes the sync.

## Step 5: redraw or retire a reference

A redraw follows an intentional design change and nothing else. Keep the index row, change the sync's mapping only where the frame moved on the canvas, and run the sync so it rewrites the files.

Retire a reference in the change that removes its surface from the app.

- Drop the surface from the sync's mapping and run the sync, so the sync removes its files
- Remove the group's index row when the group holds nothing else
- When the sync leaves the files and its check reports them stray, name each path and ask the operator, since no session deletes a reference by hand

## Output

```plaintext
✅ Design record: <landed, redrawn, retired, or set up>
Group:  <group>, <name>
Files:  <each file the sync wrote or removed>
Index:  <the row added, changed, or removed, or unchanged>
```

Emit every path from the project root. Omit the files line when nothing was written.
