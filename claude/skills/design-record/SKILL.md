---
name: design-record
description: Keeps the project's design record, being the design document at `canon/DESIGN.md` and the reference folder at `canon/design/` holding the accepted frames a build matches. Sets the folder up, lands a picked design through the project's design sync, keeps the index, redraws or retires a reference when its surface changes, and carries a pick's values into the stylesheet and its intent into the design document. Use whenever a picked frame or design moves into `canon/design/` or `canon/DESIGN.md`, before running the project's design sync or editing the index, including when asked to "land it in the design references", "add a design reference", "land this pick", "set up canon/design", "update the design index", "redraw the reference for X", "remove the reference for X", or "update DESIGN.md". Do NOT use to draft candidates or take a pick, which is `pick-by-eye`, to draw frames on a board, which is Frameboard, or to judge a design, which is `design-taste`.
metadata:
  family: ship
---

# Design record

Keep the record of what the project's design is. The record has two halves, each with its own standard to read before writing it.

| Half             | Path              | Standard                                   |
| ---------------- | ----------------- | ------------------------------------------ |
| Design document  | `canon/DESIGN.md` | `${CLAUDE_SKILL_DIR}/references/design.md` |
| Reference folder | `canon/design/`   | `${CLAUDE_SKILL_DIR}/references/folder.md` |

The document holds the rules and each role's intent, and the folder holds the pictures a build matches.

## Guards

- Write no reference file by hand, whether a copy, an edit, or a delete. The project's design sync writes the frames, so a hand-written file drifts from the frame it claims to show.
- Never land a candidate the operator has not picked. The folder holds accepted designs, and a draft lives on the board.

## Step 1: read the record

Read `canon/design/index.md` from the project root, and list the group folders beside it.

- A missing folder or index is set up at Step 3, once Step 2 has found the sync
- An index carrying a file list or a canvas mapping is an older shape. Leave its rows in place, add new rows in the form `folder.md` gives, and say the index predates the standard.

## Step 2: find the project's design sync

Find the sync before writing anything, since every folder step runs through it. Read the project's scripts, such as the `scripts` block of `package.json`, for the command that writes frames into `canon/design/`. Run its `--help` when it offers one, for its mapping file and its check.

When no sync resolves, skip Steps 3 to 5 and capture no frame in the sync's place. Report `⚠ No design sync found, so the pick did not land in canon/design/. Add one or name the command, then re-run.` and go on to Step 6, which needs no sync.

## Step 3: set up the folder

Skip this step when `canon/design/index.md` exists, even as a stub, since a stub the project's stack seeded is the setup.

1. Write `canon/design/index.md` from the template in `folder.md`, with one row per group the first pick needs.
2. Leave the group folders to the sync, since git tracks no empty folder and the sync creates each one as it writes.

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

## Step 6: carry a pick into the design document

A pick that settles color, type, spacing, or radius changes the design document as well as the folder. Skip this step when the pick changed layout or structure alone, since the reference carries that.

- Carry each value into the stylesheet the document's lead names, and its intent into the document's sections under `design.md`
- A project with no stylesheet yet writes one of its own for the values, and the lead names its path
- A values record names in its lead the module it renders from and the command that renders it. Edit that module and run that command, never the document.

Never cite a board frame path from the document or the index. The board folder is gitignored, so the citation resolves on one machine alone.

## Output

```plaintext
✅ Design record: <landed, redrawn, retired, set up, or carried>
Group:  <group>, <name>
Files:  <each file the sync wrote or removed>
Index:  <the row added, changed, or removed, or unchanged>
Design: <the stylesheet and design document the values went to, or unchanged>
```

Emit every path from the project root. Omit the files line when nothing was written.
