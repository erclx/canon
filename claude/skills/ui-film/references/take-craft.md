---
title: Take craft
description: The filming rules a take plan follows, the frame-stepping limits, and the pointer and zoom rules the camera relies on, each with its source
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
- Keep a take as long as its beat. The verb opens and closes each one on a 0.6 s hold, which gives the edit a still to cut on, so add no hold of your own around the action.
- Add a `wait` after an action whose result animates, loads, or settles, long enough for the result to finish on screen
- Reach the beat's start state through `setup`, since every beat opens the page fresh and nothing a setup step does is filmed
- Write the beat's `name` as the operator approved it, since it names the clip's folder

### Server state

Every beat reloads the page, never the server. An app holding its state in server memory keeps a change one beat made, so the next beat opens on it.

- Undo the change in the next beat's `setup`, or order the beats so each one's result is the next one's start
- Restart the server between beats only when neither works, since a restart costs the served address its warm start

## Frame-stepping limits

A step beat runs the page on a virtual clock, one frame per step. Most pages film this way, and some inputs are known to stall it.

- Typing films by stepping on a canvas board, though an earlier stepper stalled on it. Keep `fill` text short, and expect a fallback to the screencast for a beat whose frames stall past 2 s.
- A scroll has not been proven under frame stepping, and a smooth scroll can jump. Give a scroll its own beat so a fallback costs that beat alone.
- An animated GIF can freeze, so expect one to hold its first frame
- Set `"route": "screencast"` on a beat known to stall, rather than paying for the stall before the fallback
- Set a top-level `"route": "screencast"` on a plan whose page stalls on every beat, and a beat naming its own `route` keeps it

A fallback films the beat again from a fresh load, replaying its setup and the steps the stepper already ran. A beat whose steps persist in the app, such as a fill that renames something, would then start from the changed state, so set `"route": "screencast"` on it when it risks a stall.

A screencast beat films in real time at 1920x1080, so its camera zooms only to about 1.35x before it would go soft. Tell the operator which beats ran that way.

### Reading a take back

Two rules hold once a beat is filmed.

- A stepped still is 3840x2160 and opens at 2000 wide. Crop it for text too small to read there, with `ffmpeg -v error -y -i <dir>/still.jpg -vf crop=<w>:<h>:<x>:<y> <dir>/crop.png` on the still's own pixels.
- Read when something happened from `log.json` and `camera.json`, both on the clip's clock, never from a clock printed in the page, which starts before the first kept frame

## Targets

- Prefer a stable attribute, such as an `aria-label`, a `data-testid`, or an `id`, over a position like `:nth-child`
- Use `text=<words>` for a control whose only stable handle is its label
- Target a control with no visible text, such as an icon button, by its `aria-label`, since `text=` finds nothing on it
- Use a `move` to a point only for a target the page reveals on hover, and follow it with the click
- Read each target off the served page before writing it. The verb refuses `target-missing` rather than filming a guess, and a refusal costs a reload.

## The pointer

- Draw no pointer in the page. The edit draws one from the log at a constant size, and two pointers on one frame leave the viewer guessing which one acted.
- Start from a state where the app paints no cursor of its own, since a painted one films into the clip and grows with every zoom
- Check that each click lands inside its target's box on the closing still. The verb aims at the box's center, and an element covering it takes the click instead.

## The zoom

The camera track already carries the zoom, so these rules decide what to film for it to aim at.

- Earn a zoom with an action. The camera aims only at clicks and typing, and a wait, a move, or a scroll aims nowhere, so a result too small to read needs a click on it.
- Expect a scroll to end a zoom, since the content moves under the camera
- Expect a target filling most of the view to get less zoom, and one filling the page to get none
- The push reaches 90% of its depth in about 633 ms, inside the 1 s ceiling a push onto an action keeps

### Depth, opt-out, and speed

Three controls change the push itself.

- Expect a screencast beat's zoom to stop near 1.35x, since its clip has one pixel per page pixel, and a stepped beat's to reach 1.8x
- Set `"push": false` on a beat the edit holds wide, such as one showing a whole layout change. Its track keeps the cursor and the click ring and drops the zoom.
- Rebuild a beat's track with `canon take camera <dir>/log.json --rate <n> --out <file>` for a clip the edit plays `n` times faster, so the zoom settles on the clock a viewer sees

## One source for on-camera content

A take shows content the app loads or a script writes, such as a fixture, a snapshot, or copy typed into a field. Keep one source for it, naming whatever the take reads on camera.

- Generate every derived copy from that source rather than keeping it by hand, since a hand copy goes stale and a reshoot films the old content
- List the source and each generated copy in the README's `## Filming` section, with the command that regenerates them
- Regenerate the copies before a re-film after the source changes

## The harness route

A beat driven from outside the page, such as a drag between two windows or an input the step kinds lack, cannot run as `canon take` steps. Until the verb can run an outside script itself, film it through a harness.

- Keep each script in the workspace's `harness/` folder and write its output into the take's own folder, never at the workspace root
- Drive the beat from a Playwright script that records the page and writes a log in the shape of a take's `log.json`
- Build its camera track from that log with `canon take camera <log> --out <file>`, so the composition applies it like any other take
- Tell the operator which beats ran this way, since their clips carry the harness's resolution rather than the stepper's

## Sources

| Rule                       | Source                                                                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zoom on a click            | Screen Studio's [auto zoom guide](https://screen.studio/guide/auto-zoom) keys its zoom on click positions                                                |
| The 1 s ceiling            | Material Design 3's [duration tokens](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs) end at 1000 ms, the top of the ambient band |
| The 633 ms push            | Twelve moves in a Screen Studio clip reached 90% in a median of 667 ms, measured when the camera was tuned                                               |
| The typing and scroll risk | Takes of a canvas design board filmed while the stepper was built                                                                                        |
| Jumping scrolls and GIFs   | [hasuwini77/demo-reel#28](https://github.com/hasuwini77/demo-reel/pull/28), read through a search summary rather than the page                           |

The pointer rules carry no number. One pointer and a click inside its box follow from the log recording each target's box.
