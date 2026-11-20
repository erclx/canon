---
title: Take craft
description: The filming rules a take plan follows, the frame-stepping limits, the pointer rules, where the zoom rules live, and how a beat is framed, each with its source
---

# Take craft

Read at Step 3 of `ui-film`, before writing the first beat. `canon take --help` carries every step kind, the target forms, and each refusal code, so this file carries the judgment and leaves the vocabulary to the verb.

## Contents

- [The plan](#the-plan)
- [One action per take](#one-action-per-take)
- [Frame-stepping limits](#frame-stepping-limits)
- [Targets](#targets)
- [The pointer](#the-pointer)
- [The zoom](#the-zoom)
- [Framing](#framing)
- [One source for on-camera content](#one-source-for-on-camera-content)
- [The harness route](#the-harness-route)
- [Sources](#sources)

## The plan

A plan holds the approved beats in order. Each beat names its setup, which runs before the first kept frame, and its steps, which are filmed.

```json
{
  "beats": [
    {
      "name": "Open the kit",
      "setup": [{ "kind": "click", "target": "text=Design" }],
      "steps": [
        { "kind": "click", "target": "[aria-label='Open 01-kit']" },
        { "kind": "wait", "ms": 900 }
      ]
    }
  ]
}
```

## One action per take

- Film one action per beat, such as one click, one fill, or one scroll, so the edit can cut, reorder, or drop a beat without re-filming its neighbors
- Keep a take as long as its beat. The verb holds still at each end and paces each press and its result, at the timings `canon take --help` prints, so add no hold of your own around the action.
- Add a `wait` after an action whose result animates, loads, or settles, long enough for the result to finish on screen
- Reach the beat's start state through `setup`, since every beat opens the page fresh and nothing a setup step does is filmed
- Write the beat's `name` as the operator approved it, since it names the clip's folder

### Server state

Every beat reloads the page, never the server. An app holding its state in server memory keeps a change one beat made, so the next beat opens on it.

- Undo the change in the next beat's `setup`, or order the beats so each one's result is the next one's start
- Restart the server between beats only when neither works, since a restart costs the served address its warm start

### Loading and error states

A state that shows only while a request is pending, or only once it fails, has passed by the time a beat films. Hold or fail the request that ends it with the beat's `network` list, which `canon take --help` documents.

- Hold the request to film a loading placeholder, and abort it to film the error view
- Match the request's whole address with `*` for the parts that vary, such as `*/api/report*`, and read the address off the page's own requests rather than guessing it
- Expect a refusal as `network-unmatched` when a pattern caught nothing, since the beat then filmed the page without the state it names
- Hold a data request rather than a script, sheet, or image, since those keep the page from loading at all
- Film the hand-off from a placeholder to the loaded view as two beats, one held and one not, since a held request stays pending for the whole beat

## Frame-stepping limits

A step beat runs the page on a virtual clock, one frame per step. Most pages film this way, and some inputs are known to stall it.

- Typing films by stepping on a canvas board, though an earlier stepper stalled on it. Keep `fill` text short, and expect a fallback to the screencast for a beat whose frames stall past 2 s.
- A scroll has not been proven under frame stepping, and a smooth scroll can jump. Give a scroll its own beat so a fallback costs that beat alone.
- An animated GIF can freeze, so expect one to hold its first frame
- Set `"route": "screencast"` on a beat known to stall, rather than paying for the stall before the fallback
- Set a top-level `"route": "screencast"` on a plan whose page stalls on every beat, and a beat naming its own `route` keeps it

A fallback films the beat again from a fresh load, replaying its setup and the steps the stepper already ran. A beat whose steps persist in the app, such as a fill that renames something, would then start from the changed state, so set `"route": "screencast"` on it when it risks a stall.

A screencast beat films in real time at its window, 1920x1080 by default, so its camera zooms only to about 1.35x before it would go soft. Tell the operator which beats ran that way.

## Window size

Every beat films in a 1920x1080 window unless the take or the beat names another. A layout that changes below a width, such as a toolbar that folds, never shows at the default.

- Set `--viewport <width>x<height>` when the whole take belongs at one smaller size
- Set `"viewport": { "width": 800, "height": 600 }` on the one beat that needs a narrow window among wide ones, since the key wins over the option
- Keep each side even, from 320x240 up to 1920x1080. The window only shrinks, since a stepped frame is twice the window and a larger one stalls on paint alone.
- Expect the pointer to start at the beat's own center, and a target outside the smaller window to refuse as `target-offscreen` even where it sat inside the default
- Give every beat of a `--reel` take one aspect ratio. Sizes may differ, since the reel shrinks each beat to one width, and two shapes refuse as `reel-shape` before anything films.

### Reading a take back

Two rules hold once a beat is filmed.

- A stepped still is twice the beat's window. Crop text too small to read on the still's own pixels, with `ffmpeg -v error -y -i <dir>/still.jpg -vf crop=<w>:<h>:<x>:<y> <dir>/crop.png`.
- Read when something happened from `log.json` and `camera.json`, both on the clip's clock, never from a clock printed in the page, which starts before the first kept frame

## Targets

- Prefer a stable attribute, such as an `aria-label`, a `data-testid`, or an `id`, over a position like `:nth-child`
- Use `text=<words>` for a control whose only stable handle is its label
- Target a control with no visible text, such as an icon button, by its `aria-label`, since `text=` finds nothing on it
- Aim a press or a drag end at an `x` and `y`, measured at the beat's own viewport, only where no selector reaches, such as a frame, since a point breaks when the layout shifts
- Read each target off the served page and check it matches one element there. The verb refuses `target-missing` or `target-ambiguous` rather than filming a guess.

Both forms reach inside an open shadow root. A match in the document and one inside a root count as two. A zero-size copy, such as `display: none`, counts for nothing, while a transparent or `visibility: hidden` copy keeps its size and counts. Nothing reaches across a shadow boundary, a closed root, or a frame.

Open a menu the page draws with a `contextmenu` step. Neither route films the browser's own menu, so the page has to prevent it.

## The pointer

- Expect the pointer at the window center when the first filmed step starts, on either route, since the verb resets it after `setup`
- Open a beat needing the pointer elsewhere with a filmed `move`, since a `move` or `click` in `setup` never reaches the beat
- Draw no pointer in the page. The edit draws one from the log at a constant size, and two pointers on one frame leave the viewer guessing which one acted.
- Start from a state where the app paints no cursor of its own, since a painted one films into the clip and grows with every zoom
- Check that each click lands inside its target's box on the closing still. The verb aims at the box's center, and an element covering it takes the click instead.

## The zoom

The camera track carries the zoom. Read `camera-and-cursor.md` beside this file for what to film for it to aim at, the `push` and `hand` keys, and what each beat shape films as.

## Framing

A beat's view is part of what it shows, so set it before filming rather than letting the app move it.

- Film a beat that builds several elements into one fixed view fitted to its end state, so each element lands where it finishes and the next beat opens on the same view
- Reach that view by opening the page on the finished state, letting the app fit to it, then emptying it in `setup`, rather than following the app's own view as each element lands
- Film the selection a hand edit acts on, since `setup` is never filmed and a viewer who missed the selection cannot tell what changed
- End a hand edit on the edited element rather than a wide view, where neighbors that already looked the same suggest several things changed
- Set `"scrollbars": true` on a beat whose change is a scrollbar, since every take hides them by default on both routes, and leave it off otherwise because the classic gutter takes 15 px of layout width

Frameboard's launch film followed the board's own view in its first cut, which centered each frame as it landed and left a tall frame cut off below a short one.

## One source for on-camera content

A take shows content the app loads or a script writes, such as a fixture, a snapshot, or copy typed into a field. Keep one source for it, naming whatever the take reads on camera.

- Generate every derived copy from that source rather than keeping it by hand, since a hand copy goes stale and a reshoot films the old content
- List the source and each generated copy in the README's `## Filming` section, with the command that regenerates them
- Regenerate the copies before a re-film after the source changes

## The harness route

A beat driven from outside the page, such as a drag between two windows or an input the step kinds lack, runs through a Playwright harness rather than as `canon take` steps. Read `harness.md` beside this file before writing one, since it holds the route and the faults that cost a reshoot most of its refilms.

## Sources

| Rule                       | Source                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| The typing and scroll risk | Takes of a canvas design board filmed while the stepper was built                                                              |
| Framing                    | Frameboard's launch film, refilmed into a fixed view fitted to its finished frames                                             |
| Jumping scrolls and GIFs   | [hasuwini77/demo-reel#28](https://github.com/hasuwini77/demo-reel/pull/28), read through a search summary rather than the page |

The pointer rules carry no number. One pointer and a click inside its box follow from the log recording each target's box.
