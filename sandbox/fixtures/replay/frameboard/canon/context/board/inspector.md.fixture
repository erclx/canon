---
title: Inspector
description: The right panel's controls for a selected frame, several frames, or an element, the bar a new control clears, and what a hand edit writes
---

# Inspector

## Overview

Owns the controls the developer edits a selected frame or element with, the bar a new control has to clear, and what a hand edit writes into a frame.

## Layout

### `src/client/board/inspector/`

Owns the right panel, under a header of the avatar and the zoom level, and its controls. A control joins it only when the developer's edit beats asking the agent and leaves layout alone.

- **Frame and several frames:** name, position, and size, and for several the shared position and size with an Arrange button per align and distribute key
- **Element:** name, opacity, radius, and typography size, weight, and alignment, plus its text when it holds text only. The name writes `data-name`, and an empty one falls back to the derived name.
- **Fill:** color through the browser's color input with the project's tokens offered first, and fill opacity. On an element holding text alone it is the text color, as in Figma.
- **Stroke and shadow:** the border color through the same token-first row, and one of the project's shadow tokens or none, which writes `box-shadow: none` so a rule's shadow goes too.
- **Selection colors:** the colors the frame, the frames, or the element's subtree use, with token names, and a flag on raw values, read-only

The Frame section stays above an element's sections and hides its name row while an element is selected. Stroke's `+` writes `border: 1px solid var(--border)`, else the first color token.

- Under the Frame tool it lists the three presets as radio rows in place of the selection, and the chosen one is what the next canvas click places
- One selected frame's name renames in place on a click, through the same rename the layers row runs

A hand edit's write goes through `src/server/routes/edit.ts` into the edit writer, both in folders other entries own.

- A hand edit writes the element's inline style, one attribute, or its text and nothing else, through `POST /api/frames/edit`, which records one undo step
- A token pick writes `var(--token)`, so it keeps following the theme, and a raw value is marked raw
- Fill opacity below 100 percent writes `color-mix(in srgb, var(--token) N%, transparent)` over a token and an 8-digit hex over a raw hex, so the element's text and children keep their own opacity
- Colors and shadows read from the static cascade the checks use, given a property set, so a token is named exactly and a raw value that matches a token is still flagged

## Gotchas

- Element position, width, height, padding, flex, gap, border width, font family, line height, and letter spacing have no control
- Each of those is a layout call a prompt makes better, or a number that fights the layout when set by hand
- Each hand edit reloads its frame, and the element stays selected through the hash the write answers, since a reload can land before that answer or lag a later one
