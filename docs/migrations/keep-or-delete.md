---
title: Keep or delete
description: Files a project scaffolded under an older toolkit still holds, retired or customized, which sync leaves alone, and what keeping or changing each one takes
category: Agent surface
---

# Keep or delete

Each section is a file a project still holds after the toolkit retired or changed it. Sync deletes no retired file and leaves a customized one as you edited it, so keeping it or changing it is your call. The moves every project makes by hand are in [target migrations by hand](by-hand.md).

## Keep or delete the wireframes folder, your call

The wireframes record is retired, and nothing deletes what a project holds.

- `canon/wireframes/` stays yours and unaudited. Keep it as notes or delete it.
- Delete the `@canon/wireframes/index.md` line in your `CLAUDE.md` with the folder. `canon claude sync` does not rewrite it.
- `canon gov sync` removes `.claude/rules/canon/standards/wireframes.md`

## Keep or delete the retired product files, your call

The learning workspace, deck renderer, app recorder, canvas, and design install are retired with their verbs, and nothing deletes what a project holds.

- `.canon/teach/` holds HTML that opens as it is <!-- canon-keep-retired -->
- `.canon/slides/` and a `demos/` folder hold sources nothing renders any more, so delete them once nothing cites them <!-- canon-keep-retired -->
- Move the `.claude/design/project/` values, `fonts/`, and `fonts.css` to the stylesheet your `canon/DESIGN.md` lead names, then delete `.claude/design/`

A reference to a retired skill takes a hand edit.

- Replace a `canon:teach-workspace` reference with `canon:teach-craft` by hand, since `canon migrate skill-names` does not rewrite it <!-- canon-keep-retired -->
- Delete a `canon:make-deck`, `canon:script-screencast`, `canon:record-screencast`, `canon:read-frames`, or `canon:video-craft` reference, since none has a successor <!-- canon-keep-retired -->
- Delete a `canon:canvas-board` reference too. Frameboard, which `canon:design-pick` drives, reads each `.canon/canvas/` folder as a project, so move a kept page under one <!-- canon-keep-retired -->

## Keep or delete the pick archives, your call

A pick no longer copies its arms out of the board. Earlier picks left a folder of images per project under `.canon/`, such as `.canon/picks/` or `.canon/landing/`, and nothing deletes or moves one.

- Keep a folder that may hold the only copy of a losing arm, since the round's board pages were deleted when the pick closed
- Delete it once nothing cites it, and leave the record folders beside it alone, such as `.canon/intake/` and `.canon/board/`
- `canon migrate record-layout` still files an older archive under `.canon/picks/`, where the same call is yours

## Delete the retired Playwright deps script, your call

The web stack no longer ships `scripts/install-playwright-deps.sh`, and nothing deletes the copy a project already synced.

- No seeded workflow calls it, since both hosted Ubuntu images ship Chrome and the libraries Chromium loads, so deleting it is safe
- A workflow of your own may still call it, so search for the name before deleting
- A self-hosted runner adds `bunx playwright install-deps chromium` before the browser install

## Keep or delete the README screenshot files, your call

The web stack no longer ships `.github/workflows/readme-screenshot.yml`, `scripts/readme-screenshot.sh`, or the `readme-screenshot` script in `package.json`. Sync deletes nothing, so a copy you hold stays yours, and no later sync updates it.

- Keep all three if the workflow refreshes your README frame. The script sources `scripts/lib/preview-server.sh` and calls `e2e/screenshot.ts --print-evidence-root`, and the stack still ships both.
- Delete them together otherwise, since the workflow runs the script through the `package.json` entry
- `canon/config/config.json` may still hold a hash or a disposition for each path. Sync and `canon tooling diff` ignore both, and `canon tooling lift <path>` clears a declined or customized entry.

## Match the Playwright engines to CI, your call

The web stack's Playwright config now declares Chromium alone, the one engine the seeded workflow runs. Sync replaces an unedited config and keeps a customized one, telling you the golden changed.

- Remove the `firefox` and `webkit` entries from `projects` in a kept config to match, since CI never ran them
- Keep them only beside a workflow of your own that installs and runs each engine, since the seeded one passes `--project=chromium`
