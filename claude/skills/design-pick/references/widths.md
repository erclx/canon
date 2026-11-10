---
title: Round widths
description: The widths a design-pick round draws every arm at, read from the design record's Layout section with a fallback set, the sideways-scroll check that holds a pick before it folds into the surface, and how to read any measurement of a frame
---

# Round widths

Read before a `design-pick` round adds its first frame, again before a pick folds into the surface, and before trusting any number read off a frame. A pick judged at desktop alone can scroll sideways on a phone, and nobody sees it until the surface ships.

## Picking the widths

Draw every arm at one width per device class. Take the widths from the `## Layout` section of `canon/DESIGN.md` at the main worktree root, by the class each width falls in.

| Class   | Width the record gives              | Fallback |
| ------- | ----------------------------------- | -------- |
| Phone   | The narrowest it names              | 320      |
| Tablet  | The narrowest it names, 600 to 1023 | 834      |
| Desktop | The widest it names, 1024 up        | 1440     |

The table resolves each class on its own, so a record naming phone and desktop widths alone still gets a tablet.

- Fill a class the record names no width in from the fallback column
- Take all three fallbacks when the document is absent or carries no `## Layout`
- Say in the run's output which widths the round draws and which source gave each

One width per class keeps the round's frame count at three times its arms. A width between two classes rarely changes a pick, and drawing it grows the board and the composite for no new answer.

## Drawing the tablet frame

Draw a tablet frame in the desktop form first. Fall back to the phone form at that width only when the desktop form scrolls sideways there, and say which form the frame took.

## Holding a pick that scrolls sideways

No pick folds into the surface until every one of its frames renders with no sideways scroll, per [WCAG 2.2 Reflow](https://www.w3.org/TR/WCAG22/#reflow). Measure each of the picked arm's frames at the width it was drawn at:

```bash
canon browser -s=<run> open file://<frame-path>
canon browser -s=<run> resize <px> 900
canon browser -s=<run> --raw eval "document.documentElement.scrollWidth - document.documentElement.clientWidth"
```

Read the result per frame, and close the session with `canon browser -s=<run> close` after the last one.

- Read any value above 1 as a frame that scrolls sideways, and hold the pick, naming each width that failed
- Carry a held pick into the loop as a correction to the failing frames, and measure again before the close
- Report a browser refusal by its stderr and hold the pick, since an unmeasured width is not a clean one

## Reading any measurement

A capture proves appearance and a measurement proves a relationship, so reach for the second whenever the claim is a number, such as a contrast ratio, a column width, or a tap target. `canon drive` runs the probes and ships the failure modes each one carries.

- Composite alpha before reading a color. A `color-mix` toward transparent resolves to channels plus an alpha, and reading them as opaque reports a color nobody sees.
- Sample inside the shape. A patch at a bounding box corner misses a round control and reads the page behind it.
- Ask whether a reader would see the thing. A panel sized a healthy 1517 by 639 passed every size check while sitting 1868px above the viewport.

`canon drive` reports findings and never gates. Read its record as evidence for the operator rather than as a filter over the arms, since the probe catalog has not earned the right to drop one.
