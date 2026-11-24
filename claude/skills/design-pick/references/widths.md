---
title: Round widths
description: The widths a design-pick round draws every arm at, read from the design record's Layout section with a fallback set, the sideways-scroll check that holds a pick before it folds into the surface, and how to read any measurement of a frame
---

# Round widths

Read before a `design-pick` round adds its first frame, again before a pick folds into the surface, and before trusting any number read off a frame. A pick judged at desktop alone can scroll sideways on a phone, and nobody sees it until the surface ships.

## Picking the widths

Draw every arm at one width per device class the surface supports. Read the classes from `canon design classes --group <group> --json` at the main worktree root, naming the round's design group, or bare for the root record.

Take the widths from the `Draw widths:` line in the `## Layout` section of `canon/DESIGN.md`, which names phone, tablet, and desktop in that order.

| Class   | Fallback |
| ------- | -------- |
| Phone   | 390      |
| Tablet  | 768      |
| Desktop | 1280     |

The fallback is the set the screenshot harness every target syncs commits as evidence, so a drawn frame lines up with a committed still. The harness also sweeps 1536 into a folder nobody commits, and a round draws no frame there.

- Draw no frame for a class the verb leaves out, even where `Draw widths:` names a width for it
- Fill a supported class the line names no width for from the fallback column
- Take the fallbacks for every supported class when the document is absent, carries no `## Layout`, or its layout carries no `Draw widths:` line
- Say in the run's output which widths the round draws and which source gave each

A `--widths` linked width draws no device, so each class takes its own frame, added with its own `--device on`. See `${CLAUDE_SKILL_DIR}/references/drawing.md` for the add.

One width per class keeps the round's frame count at most three times its arms. A width between two classes rarely changes a pick, and drawing it grows the board and the composite for no new answer.

### Where the fallback comes from

Each width is the narrow end of its class in a ranked usage table, since a frame drawn at the narrow end shows the cramped case a wider frame hides.

- Phone 390 sits inside the band of 360 to 414 that [StatCounter's mobile ranking](https://gs.statcounter.com/screen-resolution-stats/mobile/worldwide) leads with
- Tablet 768 ranks in [StatCounter's tablet table](https://gs.statcounter.com/screen-resolution-stats/tablet/worldwide), and [Material 3](https://m3.material.io/foundations/layout/applying-layout) puts it in the medium class, from 600 to 839
- Desktop 1280 ranks in [StatCounter's desktop table](https://gs.statcounter.com/screen-resolution-stats/desktop/worldwide), and [WCAG 2.2 Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) names it as the window that reaches 320 at 400% zoom

### The 320 check

A round draws no 320 frame, and every pick is still measured at 320 for sideways scroll, as the hold below states. 320 is the reflow floor, so a phone frame drawn at 390 that scrolls at 320 fails. A surface whose classes leave phone out skips the 320 measure, since it draws no phone frame.

## Drawing the tablet frame

Draw a tablet frame only when the project supports tablet. Draw it in the desktop form first. Fall back to the phone form at that width only when the desktop form scrolls sideways there, and say which form the frame took.

## Holding a pick that scrolls sideways

No pick folds into the surface until every one of its frames renders with no sideways scroll, per [WCAG 2.2 Reflow](https://www.w3.org/TR/WCAG22/#reflow). Measure each of the picked arm's frames at the width it was drawn at, and the phone frame again at 320 where one was drawn.

Open each frame at the address the board serves, never at its file. `canon browser` refuses a local file path, and the eval then reads `about:blank`, which has no overflow and passes every width. Take the address from the `url` that `frameboard serve --json` returned, including a board another session serves (`reused: true`).

```bash
canon browser -s=<run> open <url>/frames/<project>/<page>/<frame>.html
canon browser -s=<run> resize <px> 900
canon browser -s=<run> --raw eval "location.href + ' ' + document.contentType + ' ' + (document.documentElement.scrollWidth - document.documentElement.clientWidth)"
```

The board redirects a frame to a second origin, so the printed address carries a different host and port than `<url>`. Compare the path alone. Read the result per frame, and close the session with `canon browser -s=<run> close` after the last one.

- Hold the pick unless the address ends in the frame's own `/frames/<project>/<page>/<frame>.html` and the type reads `text/html`, since a missing frame answers 404 as `text/plain` and reads 0
- Check the address again after the resize to 320, since the phone frame is measured twice and the second read must name the same frame
- Read the overflow after the address matches, and read any value above 1 as a frame that scrolls sideways. Hold the pick, naming each width that failed, 320 included.
- Carry a held pick into the loop as a correction to the failing frames, and measure again before the close
- Report a browser refusal by its stderr and hold the pick, since an unmeasured width is not a clean one

## Reading any measurement

A capture proves appearance and a measurement proves a relationship, so reach for the second whenever the claim is a number, such as a contrast ratio, a column width, or a tap target. `canon drive` runs the probes and ships the failure modes each one carries.

- Composite alpha before reading a color. A `color-mix` toward transparent resolves to channels plus an alpha, and reading them as opaque reports a color nobody sees.
- Sample inside the shape. A patch at a bounding box corner misses a round control and reads the page behind it.
- Ask whether a reader would see the thing. A panel sized a healthy 1517 by 639 passed every size check while sitting 1868px above the viewport.

`canon drive` reports findings and never gates. Read its record as evidence for the operator rather than as a filter over the arms, since the probe catalog has not earned the right to drop one.
