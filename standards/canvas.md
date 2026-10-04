---
title: Canvas reference
description: Page folders, frame files, the layout.json shape, token resolution, and what a frame must not assume on a local design canvas
---

# Canvas reference

Applies to the canvas content under `.canon/canvas/`, where each page is a folder of HTML frames and a layout file placing them. A frame is a draft drawn to be looked at and picked from, so it changes whenever someone tries a direction, and the operator clears it once the direction lands where the project keeps its design.

The folder is gitignored, so nothing in a repository checks its shape and nothing backs it up by default.

## Scope

Governs the canvas content under `.canon/canvas/`: page folder names, frame files, the `layout.json` shape, how tokens reach a frame, and what a frame must not assume about where it renders.

Does not govern:

- The design decisions a frame is drafting, such as type, color, and layout taste: the project's own design document
- The project's design document and the token module it renders from, which a picked direction is carried into: `design.md`
- The procedure that starts the canvas, reads the operator's selection, and carries a pick back, which belongs to the surface driving the canvas
- Voice, rhythm, and sentence construction in any text a frame shows: the `write-human` skill

## What a working canvas looks like

A canvas works when the operator and a session can point at the same thing and see the same thing:

- Which pages exist, and which frames sit on each?
- Where does each frame sit on its page, and at what width does it render?
- Does each frame show the project's own tokens rather than values copied into it?
- Does a frame render the same in the live canvas as in a capture?

A canvas failing these is non-conforming even when it satisfies every shape rule below.

## Pages

- Make one folder per page directly under `.canon/canvas/`. A page groups the frames compared side by side, such as the candidates for one decision.
- Name a page as one path segment of letters, digits, dots, dashes, and underscores, starting with a letter or a digit. A name opening with a dot is hidden from every listing.
- Never write a folder whose name opens with a dot. Those names are reserved for files the canvas generates and removes itself.
- Rename a page rather than copying it under a new name, so its layout and frames stay together.

## Frames

- Write one frame as one `.html` file inside its page folder. The filename without its extension is the frame's name, and the name follows the page naming rule.
- Write a frame as a whole document or as a fragment. The server writes in the `html`, `head`, and `body` a fragment leaves out, marked so a pick still matches the file.
- State a `body` whenever the frame states a `head`. The browser builds one the file leaves out, and an address the operator picks inside the frame can no longer be matched to the file.
- Write every table with its `tbody` stated, for the same reason. A browser adds one the file leaves out.
- Keep a frame self-contained. Inline its own styles and scripts, or link a file inside the same page folder, since a frame is served from its page and nothing outside the canvas resolves.
- Use the project's custom properties, `var(--<name>)`, for every value the token stylesheet defines. A literal copied from it shows the right color today and the wrong one after the next token change.
- Edit a frame by rewriting its file. The file is the frame, and nothing else holds a copy of its markup.

## Layout

- Keep one `layout.json` per page, beside its frames. It holds each frame's box and nothing else, so moving a frame never rewrites its markup.
- Key each box by the frame's name, under one top-level `frames` object.
- Give every box four finite numbers in pixels: `x` and `y` for its top-left corner on the page, `width` for the width the frame renders at, and `height` for the height it shows on the canvas.
- Leave a frame out of the layout only when its position does not matter yet. A reader places an unnamed frame in a row after the others, at the default size of 1440 by 900.
- Never write the file while a writer holds its lock, which is the same name with `.lock` appended. Two writers each replacing the whole file lose one of the two edits.
- Treat a layout that does not parse as a defect to repair, never as an empty one to overwrite. Writing over it erases every box it held.

The keys below are the ones a reader parses. The frame names are placeholders.

```json
{
  "frames": {
    "hero-a": { "x": 0, "y": 0, "width": 1440, "height": 900 },
    "hero-b": { "x": 1520, "y": 0, "width": 1440, "height": 900 }
  }
}
```

## Tokens

- Expect the token stylesheet first in every frame's `head` when it is served, ahead of anything the frame links. A stylesheet the frame links itself still wins the cascade.
- Read where the tokens come from in this order: the canvas tool's own module inside its own checkout, else the project's installed base stylesheet plus anything in its project override folder, else none. A canvas with no token source renders unstyled and says so.
- Never paste the token stylesheet into a frame. The injected copy follows the project, and a pasted one stops following it the moment it is written.

## What a frame must not assume

- Do not assume a viewport. A frame renders at its layout width on the canvas and in a capture alike, so size it with media queries against that width rather than against the operator's window.
- Do not assume the theme. The canvas theme toggle is the operator's own state, and a capture shows each frame in its default theme.
- Do not assume a network. Name only fonts the machine has, or ship the font beside the frame, since a capture refuses a frame naming a font it cannot find.
- Do not assume a default font. Set `font-family` with an installed family first on an element the frame's text inherits from, since a capture checks the first family of the text it renders and the browser's default serif is absent from many machines.
- Do not assume the frame is the source. A picked direction is carried into the project's design document or its wireframes, and the operator clears the frame once it has been carried.
- Do not assume the canvas survives the checkout. The folder is gitignored, so a lost checkout loses every page in it.

## Template

A new frame starts from this skeleton. The names in it are placeholders.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>frame-name</title>
    <style>
      html {
        font-family: installed-family, sans-serif;
      }
      main {
        padding: var(--space-lg);
        color: var(--color-text);
        background: var(--color-background);
      }
    </style>
  </head>
  <body>
    <main>
      <h1>frame-name</h1>
    </main>
  </body>
</html>
```
