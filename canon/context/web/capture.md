---
title: Visual checks and capture
description: The pull request visual checks, why the capture job reports and never commits, the committed home baseline and its sections, widths, and masks, and settling lazy content before a shot
---

# Visual checks and capture

## Overview

`.github/workflows/pr-visual-checks.yml` runs an e2e job, `bun run web:e2e`, and a capture job on every qualifying pull request. `assets/evidence/home/` is the only committed baseline of this page. `canon/context/tooling/capture.md` covers the capture harness the web stack ships, which this page runs.

## Decisions

### The capture job reports and never commits

The capture job builds through `bun run web:build`, serves through `bun run web:preview`, and runs `tooling/web/configs/e2e/screenshot.ts` against it. It copies the captured `home` tree into `assets/evidence/home/`, renaming each `default.png` to `light.png`, the one name the shared golden config and this baseline spell differently. It uploads the tree as the `landing-page-capture` artifact and reports into the job summary where it differs from the committed baseline.

The job holds `contents: read` and commits nothing, since a commit onto the pull request branch would correct drift that is never the branch's. What moves the bytes is this page reading catalog counts at build time, so a merge touching no `web/` file leaves the baseline stale. A job that committed its correction put that correction onto whichever qualifying branch ran next, whatever the branch touched.

A branch that changes what the page renders commits `assets/evidence/home/` itself, which is the capture the surface-capture rule already asks of whoever changed the surface. That commit is what gives `canon pr evidence` a before and after to compare, since without it the baseline never moves and the comparison comes back empty. Refreshing the baseline on `main` is out of scope by an operator decision, since a commit reaching the trunk with no pull request and no reviewer is a larger change. The baseline therefore goes stale between such branches, and the summary line reports it.

`web/screenshots/` and `web/evidence/` are gitignored.

### The home baseline covers the whole page

The `home` cases name seventeen sections, being `#top` and `#proof`, the eleven beats, `#provenance`, `#start`, `#field`, and `#close`, and each writes its own frame under `assets/evidence/home/<section>/<width>--<theme>.png` beside the whole-page frames. Seventeen is the whole page rather than a sample, because a set with a gap in it reads as coverage and a reviewer has no way to see which part was never shot.

Both themes are captured, since a regression showing only on the dark ground changes no light frame and `canon pr evidence` compares per file. The sweep runs four widths, 320, 768, 1280, and 1536, and the committed baseline keeps 320 and 1280, which takes the set to 72 frames where four widths would reach 144. 320 is the conformance floor and stays. `pr-visual-checks.yml` drops the 768 and 1536 frames after copying the sweep, and the `evidence` flag on `VIEWPORTS` in the harness names the same two for a project committing evidence through the harness itself. A branch regenerates only the sections it changed.

The token preview inside the merge beat declares Geist, so `merge/` and the whole-page frames are refreshed from a `landing-page-capture` artifact of a `workflow_dispatch` run on `main` rather than from a local capture, which renders a different fallback font.

### Masking the version

The `home` cases mask `.version`, which matches both the nav badge and the footer link. The version moves on every release with no code change, and the nav badge's `data-published` moves on a registry read, so an unmasked release moved the four whole-page frames with nothing on the page having changed. Every frame paints both boxes in Playwright's default magenta, and `web/e2e/screenshot-sections.spec.ts` reads that fill back out of the footer badge's box.

## Gotchas

- An `<img loading="lazy">` or `<iframe loading="lazy">` stays unloaded until it nears the viewport, so a full-page capture that scrolls nothing shows the evidence pair and the token preview empty, and a Playwright assertion against the frame reads it as empty on a bare `page.goto('/')`. Scroll the beat into view first.
- A second `page.waitForLoadState('networkidle')` does not re-arm for a request a scroll starts, since it reads a lifecycle event of the navigation that has already fired, so it runs to its full 30 second timeout. Wait on the condition itself: `document.readyState`, every entry in `document.images` reading `complete`, and each same-origin frame's own `readyState`, under an explicit timeout.
- An element screenshot scrolls its element into view before cutting the frame, so the sticky nav rides into the middle of any element taller than the viewport. Dropping whatever computes to `position: sticky` or `fixed` to `static` for the cut costs no layout, which is what `tooling/web/configs/e2e/screenshot.ts` does through the screenshot's `style` option on a section frame alone.
- The harness creates its context with `reducedMotion: 'reduce'` and settles before it shoots, scrolling each named section into view and waiting fonts, images, and same-origin frames out, so the baseline shows the merge fan, the provenance ledger, the evidence pair, and the token preview at their end state. A capture routed through the harness needs neither escape above, and one written by hand still does.
