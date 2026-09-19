---
title: Capture
description: Rendering HTML sources to PNG, what the command asserts about fonts, and why the selector has no default
---

# Capture

`canon capture [source] --selector <sel>` renders HTML sources to PNG, which is how a generated documentation image is rebuilt from the markup it was generated out of. The source defaults to `assets/`, where a directory expands to every `.html` directly inside it, so adding a capture means dropping a file beside the first one and running the same command. That default is a generic starting point rather than a convention every target shares, and it stays because a missing folder still refuses loud, naming the argument, rather than failing silently. This repository no longer takes it: its own sources moved to `assets/captures/` and its images moved to `assets/evidence/`, so a run here names the source explicitly and sends the output where that run wants it, `--out assets/evidence` to rebuild the committed images and somewhere disposable to preview them.

```bash
canon capture --selector .window
canon capture assets/captures/install.html --selector .window --out assets/evidence
canon capture assets/captures --selector .window --out .canon/review/captures
canon capture https://example.com --selector .window --out preview.png
```

`--selector` is required and every example above passes it. The element a capture crops to belongs to the page, not to the command, so there is no value that could be right for an arbitrary project's markup. `.window` is what this repository's own five sources declare, and a project renders its own pages by naming whatever theirs declare.

## What this repository captures

A capture set here spans two folders. `assets/captures/` holds three sources and the template each is written from, and `assets/evidence/` holds their images and the built-page capture a document points at with the stamp answering for each, under the segment `canon pr evidence` compares. One run over the source folder rebuilds every image, and it takes `--out assets/evidence` to put each PNG where its document points rather than beside the markup it rendered. None of the three sources is edited by hand. `scripts/core/regen-hero.sh` writes each `.html` from the template beside it, filling one shared value map into all of them, and `bun run check` regenerates them and fails on the difference.

Two of the three take catalog data, so a stack gaining a rule moves the frame on the next run. `install.html` is the exception, since it holds terminal text from a real run in its template rather than derived from a live catalog at build time. `assets/evidence/arrival.png` is the one image with no source here: it is the built page's `.fold` element captured in dark mode against a local `web/` preview, since `canon capture` takes no color scheme and the page follows the browser's default of light, so it is retaken by hand when the page's first screen changes.

`assets/captures/` is read flat and never descends, by the regeneration script, by this command, and by the drift stage alike. A source nested a further folder down is skipped by all three with nothing reported, so a new frame is a template dropped directly in rather than a folder of its own. The split is what retired the name prefix the flat layout used to need: a frame is named for itself now, since `assets/captures/` no longer mixes markup in with the images.

Only the HTML is asserted for drift. The PNG is a chromium render whose bytes move with the browser version, so rebuild it with `canon capture assets/captures --selector .window --out assets/evidence` when the check reports the HTML changed.

Every render writes a stamp beside its PNG, `hero.png` next to `hero.stamp`, holding the source filename, a `source-sha256` over the markup bytes it read, and an `image-sha256` over the image bytes it wrote. Both digests are what `bun run check` compares, so a markup edit committed without a capture and a PNG swapped under unchanged markup each fail. The stamp is tracked and commits alongside the pair. A capture that cannot write it reports that source as failed and exits 1, so an image whose stamp never landed is reported rather than passed over.

Neither digest is ever written by hand. A digest is what the gate compares, so a hand-set one asserts agreement the tool never checked, and the way to move it is a capture. The `source:` line above them is the one field a rename may correct in place, since nothing reads it and the alternative is a stamp naming a file that no longer exists. Renaming a frame is the case that comes up, and the correction is the same basename the next capture would have written anyway.

| Option             | Behavior                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `--out <dir>`      | Write every PNG here instead of beside its source. For a URL source, names the destination PNG itself. |
| `--selector <sel>` | Element to capture, required and never defaulted                                                       |
| `--width <px>`     | Render at this viewport width so a media query resolves there. One whole number of 1 or more.          |

## What the command asserts

Each source renders at `deviceScaleFactor` 2 with a transparent background, and the success line reports the pixel dimensions the element wrapped to. Size is reported and never asserted. The height of a terminal frame is whatever its text wrapped to at a fixed width, so pinning that number would harden an accident.

What is asserted is the font. The command reads the first family the captured element declares and fails when the browser did not resolve it, because a fallback face rewraps the block and silently changes the output. Sources therefore name a real font rather than relying on `monospace`. A source that cannot render reports its own line and exits 1 without dropping the rest of the batch.

A run refuses before it reads anything else when `--selector` is absent, naming the flag and pointing at `--help`. Ordering it first is what keeps the message about the invocation: the source defaults to `assets`, so checking that first would answer `assets not found` from whatever directory the caller happened to be in and say nothing about the flag that was actually missing. That source default is a deliberate choice rather than one inherited from some general convention: a missing folder still refuses loud, naming the argument, once the flag check passes, where the selector's dropped default cropped the wrong region in silence.

The browser binary installs separately from the package. A first run does `bunx playwright install chromium` once, and a run that cannot launch one reports the engine's own remediation inside the frame and exits 1 rather than escaping as a stack trace.

The command ships to targets, alongside `demo`, `inventory`, and `drive`. It was held back while its only caller was this repository regenerating its own committed images, which described the caller rather than the render. A project has generated pages of its own, and the command that would show them rendering and prove their fonts resolved was the one it could not run.

Shipping it also fixed what the exclusion was hiding. The render module imported the `@playwright/test` development dependency, which no published tarball carries. Every browser reference still sits behind a dynamic import, so a browser loads for this command rather than in front of every other one.

`demo.md` and `driver.md` cover two of the other three browser commands. What separates this one is that a capture renders a single state, from a file on disk or a named `http(s)://` URL, where the rest drive a running application.

## Capturing at a width

`--width` sets the browser viewport and leaves the page alone. A media query answers to the viewport, so a wrapper narrowed to 390px renders a thin column of the desktop layout and proves nothing about the mobile one. The height stays at Playwright's default of 720, which keeps `vh` units where they are without the flag. A run that passes no `--width` passes no viewport option at all, so every committed image renders as before and no stamp digest moves.

The flag takes one integer and no list. A sweep across breakpoints is one run per width, and the caller picks `--out` for each, since two widths written into one directory overwrite each other under the source's name. A value that is not a whole number of 1 or more refuses ahead of the browser import, naming the flag.
