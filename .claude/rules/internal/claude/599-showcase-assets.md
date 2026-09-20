---
description: State the regenerate-then-capture-then-commit obligation for assets/captures/*.html.tmpl and its generation script
paths:
  - 'assets/captures/*.html.tmpl'
  - 'scripts/core/regen-hero.sh'
---

# Showcase asset standards

## Regenerating a frame

- After editing a template or the generation script, run `scripts/core/regen-hero.sh --check`, which fills every template into a temp folder and fails on a renamed featured skill, an empty catalog, or an unresolved placeholder. Commit no frame file for a change to a count or a token, since the refresh workflow regenerates the markup, the PNG, and the stamp from `main` and opens one pull request for them.
- Run `scripts/core/regen-hero.sh` and `canon capture` (see `canon docs capture`) and commit the markup, the PNG, and the stamp together only when the change is to the frame itself and its image has to be seen in the pull request. A stamp recording a source digest the committed markup does not match fails the stamp check.
- Add a new frame as a template directly under `assets/captures/`, named for the frame alone. A folder of its own is skipped silently by the generation script and the capture command alike, so the nesting stops at that one level.

## Capture source

- A capture source lives under `assets/captures/` and the image it renders to lives in `assets/`. `captureBases` globs `assets/captures/*.html` and reads no other folder, so a page rendered from anywhere else has no route to a gated capture, and `readCaptureSet` looks for the `.png` and the `.stamp` in `assets/` rather than beside the markup.
