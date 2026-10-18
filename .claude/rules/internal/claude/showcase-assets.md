---
description: State the regenerate-then-capture-then-commit obligation for assets/captures/*.html.tmpl and its generation script
paths:
  - 'assets/captures/*.html.tmpl'
  - 'scripts/core/regen-hero.ts'
  - 'src/capture/frame-values.ts'
---

# Showcase asset standards

## Regenerating a frame

- Run `bun scripts/core/regen-hero.ts --check` after editing a template or the generation script. It fails on a renamed featured skill, an empty catalog, or an unresolved placeholder.
- Commit no frame file for a change to a count or a token, since the refresh workflow regenerates the markup, the PNG, and the stamp from `main`.
- Run `bun scripts/core/regen-hero.ts` and `canon capture` and commit their output only when the frame itself changes and its image has to be seen in the pull request.
- Commit the markup, the PNG, and the stamp together, since a stamp recording a digest the committed markup does not match fails the stamp check.
- Add a new frame as a template directly under `assets/captures/`, named for the frame alone.
- Never nest a template in a folder of its own, which the generation script and the capture command both skip silently.

## Capture source

- Put a capture source under `assets/captures/`, since `captureBases` globs `assets/captures/*.html` and reads no other folder.
- Write the rendered `.png` and `.stamp` to `assets/`, never beside the markup, since `readCaptureSet` looks for them there.
