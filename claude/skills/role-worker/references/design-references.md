---
title: Building against design references
description: How a worker opens a plan's design references and reference images before editing a surface, and where it takes sizes, spacing, and colors from
---

# Building against design references and images

Part of `role-worker`'s `## Where the session stands`. The session reads this file before the first edit to a surface a plan's `## Design references` or `## Reference images` names.

A plan's `## Design references` names the accepted design per surface, and `## Reference images` names images it was shaped against by main-root path. Either can appear alone. Open both before building, since a worker reading the dark image alone ships a light theme nobody saw.

- Open each cited folder's light and dark images and its frame HTML before the first edit to that surface
- Take sizes, spacing, and colors from the frame HTML rather than from the image
- Report a missing reference by its path rather than building without it
- Leave `None identified.` as it stands and build without a reference

## A redrawn reference

An entry opening on `redrawn` names a folder this change leaves untrue, so the reference moves with the surface in the same pull request. The sync writes the folder from the board frame, so the frame moves first.

- Land the redraw first, in the branch's first commit, through `design-record` once the board frame carries the change, then build against the redrawn folder
- Never edit the tracked copy under `canon/design/` by hand, since the next sync overwrites it from the board
- Take the sync command from the plan's `## Files to touch` line for the folder, and report a redrawn entry with no such line rather than guessing one
- Build against an entry opening on `built against` as above and leave its folder unchanged

### Who draws the frame

A worker redraws the board frame itself when the redraw follows from the build, meaning the diff fully decides the frame's new content. The plan's change is the intentional design change the design-reference rule asks for, so a redraw passing this test needs no pick of its own.

- A redraw follows from the build when it removes an element, renames a label, or changes a count the diff changed, and adds no layout, color, or component
- Report a redraw needing any other choice, draw nothing on the frame, and leave it for a sketch round, since a worker lands no candidate the operator has not picked
- Leave a folder the plan's `## Constraints` holds for another row, frame included, and build against it as it stands

### Drawing on the board

The board folder is gitignored and sits at the main root, one copy every worktree and the sync share. Two workers redrawing one group at once can overwrite each other with no history to recover.

- Resolve the board at the main worktree root the way `${CLAUDE_SKILL_DIR}/../design-pick/references/board.md` states, never in this worktree, where no copy exists
- Edit through Frameboard's own verbs, such as `frameboard edit` and `frameboard remove`, with `--root` at that board, and route any edit no verb covers per `session-worktree`'s main-root writes
- Touch only the frames of references this change makes untrue
- Read each frame before editing it, and report rather than write over a frame that no longer shows what its folder holds
- Run the sync and its check after the redraw and ahead of the first commit, as `design-record` Step 5 orders

### A reference the plan never named

A change can make a reference untrue that the plan's `## Design references` never cited. Check each `canon/design/` group whose `## Code` names a file this branch touches.

- Redraw an unnamed reference under the same test, and name it as a departure from the plan in the pull request announcement
- Report an unnamed reference failing the test the same way as a named one, and build without moving it
- Name each frame this session drew in the pull request description, since no pick stands behind it and both reviewers read it there
