---
title: Evidence modes
description: The dev and prod meanings of evidence, the one boundary that sorts a folder between them, a row per kind with its writer and gate and whether canon pr evidence compares it, the folders carrying the segment and neither kind, and the products with no dev baseline yet
---

# Evidence modes

## Two jobs under one name

Dev evidence is the regression baseline a developer compares across a change. Prod evidence is a capture shown to a reader of the README, the site, or the examples. The folder name is the same for both, so the kind is read from the location.

Under `assets/evidence/` is dev, and anywhere else a tracked folder is named `evidence` is prod. Apply that sentence to a new folder before reading anything else about it.

`canon pr evidence` is blind to the split. `isEvidencePath` in `src/pr/evidence.ts` accepts any path with a segment equal to `evidence` and an image extension, so both kinds get a before and after in review.

## The tracked kinds

| Kind               | Folder                                                  | Writer                                                     | Gate                                                  | Compared |
| ------------------ | ------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------- | -------- |
| Dev, the site      | `assets/evidence/home/`                                 | the capture job, or the branch that changes the page       | none, the surface-capture rule asks for the commit    | yes      |
| Dev, the canvas    | `assets/evidence/canvas/<area>/`                        | the session changing the canvas shell                      | none, the `internal-canvas` skill asks for the commit | yes      |
| Prod, the examples | `examples/teach/evidence/`, `examples/design/evidence/` | `canon capture`, which writes a `.stamp` beside each image | none, an example is disclaimed rather than gated      | yes      |
| Prod, the site     | `web/public/evidence/`                                  | hand-placed, two fixed captures of one pull request        | none                                                  | yes      |

The marketing images, being the hero, the social card, and the arrival and install frames, sit in `assets/frames/` and are not evidence of either kind. `canon pr evidence` never compares them, and the capture-stamp stage gates them. `canon/context/web/assets.md` owns the social card and the beat captures.

The canvas baseline sits in one `canvas/` folder with a subfolder per area, being `arrange`, `inspector`, `layers`, and `shell`, the way `home/` holds its sections. A slice commits its walk states into the area its walk exercises and adds a fifth area only for a region none of the four covers. A frame never repeats its folder in its name.

## Folders carrying the segment and neither kind

Three gitignored spellings hold no baseline and no shown capture:

- `web/evidence/`: unused on purpose, named in `.gitignore`
- `.canon/evidence/`: the record folder `canon migrate scratch-evidence` writes
- a groundwork track's `evidence/`: the proof a spike's finding cites, which `canon/context/development/records.md` covers

## Known gaps

Three products commit no dev baseline: teach, slides, and design. A baseline for each would sit at `assets/evidence/<product>/`, and none exists. Each product's context entry says so and stops there.

## The target side

The web stack seeds `scripts/readme-screenshot.sh`, which copies a target's README frame into `assets/evidence/readme/`. That is a prod frame under the dev folder, so the boundary here is this repository's own, and a target is never assumed to hold dev evidence alone. Conforming the seed is a follow-up. The harness it ships is covered in `canon/context/tooling/capture.md`.
