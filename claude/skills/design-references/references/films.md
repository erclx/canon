---
title: Reference films
description: Take plan shapes for a scroll read as stills and for nav and action hovers on an outside site, how a hover target is picked from a snapshot, and what a refused take leaves
---

# Reference films

Read before writing the first take plan in a `design-references` run. A still taken at one scroll position paints a scroll-linked layer where the visitor never sees it, and a hover state does not exist in a still at all, so both are filmed.

`canon take` films each beat from a fresh load of the page, on the plan shape its `--help` prints. Write each plan to `<page-dir>/<site>/takes/<name>.json` and film it into the folder beside it:

```bash
canon take <url> <plan> --out <page-dir>/<site>/takes/<name> --reel <page-dir>/<site>/takes/<name>.webp --max-seconds 60 --json
```

- Read each beat's `still` off the record, the clip's closing frame, which is the image the agent reads and the frame links
- Link the reel from the frame for the operator, since it shows the motion between the stills
- Set `"route": "screencast"` and `"push": false` on every plan, since a reference needs the whole page at a visitor's size rather than a zoom

## The scroll

One take, one beat per stop. A beat reloads the page, so each stop's beat wheels down to its stop in `setup` and holds there in `steps`, and its still is the page at that stop.

```json
{
  "route": "screencast",
  "beats": [
    {
      "name": "stop 2",
      "push": false,
      "setup": [
        { "kind": "wait", "ms": 2000 },
        { "kind": "scroll", "target": "body", "dy": 900 },
        { "kind": "scroll", "target": "body", "dy": 900 }
      ],
      "steps": [{ "kind": "wait", "ms": 600 }]
    }
  ]
}
```

- Write stops 0 to 4, each adding one 900 px wheel to the setup of the stop before it, so the five stills cover the first four and a half screens
- Wheel rather than jump, since a scroll-linked layer reads wheel events and sits differently after a jump
- Keep the opening 2000 ms wait on every beat, so a page that animates in has settled before the stop

## Hovers

Up to three hovers per site, each its own take of one beat, so a target that refuses costs that hover alone.

```json
{
  "route": "screencast",
  "beats": [
    {
      "name": "hover product",
      "push": false,
      "setup": [{ "kind": "wait", "ms": 2000 }],
      "steps": [{ "kind": "move", "target": "text=Product", "hold": 1500 }]
    }
  ]
}
```

### Picking the target

Pick each target from the page as a visitor sees it, never from memory of the site. Run every `canon browser` command from `<page-dir>/<site>/`, since its snapshots land in `.playwright-cli/` under the folder it runs in and the project root is tracked.

1. Open the page with `canon browser -s=<site> open <url>` and read `canon browser -s=<site> snapshot`.
2. Take the nav entries that open a menu and the first primary action in the header or the hero.
3. Write each target as `text=<words>`, being the element's whole visible text exactly as the snapshot shows it. `take` matches the whole text, so a partial label misses.
4. Close the session with `canon browser -s=<site> close`.

### A consent banner

Add a `click` on the banner's dismiss button to every beat's `setup` when the snapshot shows one. `take` reaches a target in the document or inside an open shadow root.

- Film the beat again without the click when the take refuses `target-missing` on it, since the banner sits where no query reaches and a film with it beats no film
- Say on the site's notes frame that the banner sits in the films

## Refusals

A refusal names its `reason` and its `beat`. Report it on the site's notes frame and keep everything that landed.

| Reason                                                | What stands                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `target-missing` on a hover                           | Every other hover and the scroll. The record's `still` shows why.  |
| `target-offscreen` on a hover                         | The same, since a nav target off screen at desktop is not a hover  |
| `over-cap` on the scroll                              | The stops filmed before the cap, read off `take.json` beside them  |
| `server-unreachable`                                  | Every shot, since the site answered the capture and not the film   |
| `ffmpeg-missing`, `browser-missing`, `engine-missing` | Every shot, and no film for any site, so say the films did not run |
