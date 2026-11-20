---
title: Camera and cursor
description: Eleven filmed scenarios on a three-column app page, the zoom rules and the push and hand keys, the pace a take keeps, the pointer look, and the rules a beat writer follows
---

# Camera and cursor

Read beside `take-craft.md` at Step 3 of `ui-film`, before writing the first beat. The verb applies the pace and the camera on its own, so this file tells a beat writer what to film for the camera to aim at, what a beat shape will film as, and which key changes it.

## Contents

- [The scenarios](#the-scenarios)
- [The zoom](#the-zoom)
- [The pace](#the-pace)
- [The timing check](#the-timing-check)
- [The look](#the-look)
- [Rules for a beat writer](#rules-for-a-beat-writer)
- [Sources](#sources)

## The scenarios

Each scenario was filmed on one 1920x1080 app page with a left nav, a grid of 36 cards, and a right inspector holding a dropdown, a text field, a progress slider, and a save button. A theme toggle sits in the header, and a hidden trigger has an agent add three cards with no hand on the page. The operator judged every render by eye.

### One region

These beats act inside one part of the page.

| Scenario                 | What the camera and cursor do                                                  |
| ------------------------ | ------------------------------------------------------------------------------ |
| One press                | Zooms in over the glide onto the control and out over the glide leaving it     |
| Two presses in one area  | Holds one zoom over both presses, panning only if the second falls out of view |
| Type a name, then save   | Rests on the field, steps the cursor off it, types, then glides to the button  |
| Drag the progress slider | Aims once over both drag ends and holds the ring from press to release         |

### Across the page

These beats reach from one region to another.

| Scenario                  | What the camera and cursor do                                                |
| ------------------------- | ---------------------------------------------------------------------------- |
| A far jump, right to left | Holds its depth and pans along the glide rather than pulling out and back in |
| A tour of three regions   | One zoom that pans region to region for as long as the presses keep coming   |
| A result elsewhere        | A `move` carrying `hold` glides to the result, and the camera holds on it    |

### Scrolls and changes without a press

These beats move content or the whole page rather than one control.

| Scenario                     | What the camera and cursor do                                                |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Scroll, then open a card     | Holds wide through the scroll and pushes in on the press after it            |
| Scroll from a zoomed card    | Pulls out before the wheel turns and pushes back in on the next press        |
| Switch the page to dark mode | Holds wide under `push: false`, since the change is the whole page           |
| An agent adds three cards    | Holds wide and draws no cursor under `hand: false`, since nobody's hand acts |

A harness log that splits one glide into several moves used to pump the zoom out and in at every piece. The camera now reads moves logged back to back as one glide, so a beat's zoom count follows its presses rather than how its log was written.

## The zoom

The camera track already carries the zoom, so these rules decide what to film for it to aim at.

- Earn a zoom with an action. The camera aims at a press, typing, and a `move` carrying `hold`, so a result too small to read needs one of those on it.
- Expect a wait, a plain move, or a scroll to aim nowhere
- Expect a scroll to end a zoom, since the content moves under the camera
- Expect a target filling most of the view to get less zoom, and one filling the page to get none
- The push rides the glide onto its target and lands as the cursor arrives, so it lasts as long as that glide, between 600 ms and 1.2 s

### Depth, opt-out, and speed

Three controls change the push itself.

- Expect a screencast beat's zoom to stop near 1.35x, since its clip has one pixel per page pixel, and a stepped beat's to reach 1.8x
- Set `"push": false` on a beat whose change covers the whole page, such as a theme switch or a layout change. Its track keeps the cursor and the click ring and drops the zoom.
- Set `"hand": false` on a beat no person drives, such as an agent editing the page. Its steps still run, and the camera holds wide with no cursor or ring drawn.
- Rebuild a beat's track with `canon take camera <dir>/log.json --rate <n> --out <file>` for a clip the edit plays `n` times faster, so the zoom settles on the clock a viewer sees

### The cursor leads the camera

The viewer follows the cursor, so the camera zooms where the cursor acts and never anywhere the cursor is not.

- Reach a hand action through a control the viewer can see, such as a menu item, a button, or an inspector field, since a viewer cannot repeat an action whose entry point the film never shows
- Keep a keyboard shortcut off camera unless the beat is about the shortcut, and then give it a key overlay in the edit
- Film a look-back at a changed element as a `move` to it carrying `hold`, so the cursor glides there and the camera holds on its arrival
- Never aim the camera at a point the cursor left behind, since a push onto a button while the drawn cursor sits elsewhere reads as broken
- End a hold when the cursor leaves. A glide onto the next target plus about 1 s of hold fit Frameboard's launch film, where a 3.2 s camera-only hold read as too long.

### One track per take

A camera track is read off one take's log and is true of that take alone.

- Rebuild every camera track from the new log after a re-film, each `--rate` track included, since a track left from the old take aims at moments that no longer happen
- Never hand-tune a track, since the next re-film overwrites the log under it and leaves the tuning aimed at the old clock

## The pace

Each move takes the time a person's would, and the verb paces it without a `wait` from the plan.

- A glide takes 600 ms to 1.2 s, longer for a longer reach, so a short reach no longer reads as a jump
- The cursor rests 300 ms on a target before a press, a drag, or a scroll's wheel
- A press holds 500 ms on its result before the next step
- A fill rests 450 ms on its click while the ring plays, steps the cursor over 300 ms to just past the field's bottom-right corner, and settles 150 ms before the first key

The step-off keeps the cursor from covering the text it types. It stays inside the window, so a field against the window's edge steps as far as the edge allows rather than refusing.

## The timing check

`canon take check` holds a finished take to the pace above, a frame under each constant, so an engine take passes and a harness take, a trimmed beat, or a sped-up track is held to the same. Refilm a beat on a breach, per the refilm order in `handoff.md`.

| Record or `rule`                                           | Route                                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `glide-fast`, `no-rest`, `left-early`, `zoom-fast`, `pump` | Film the beat again with the current `canon`, whose pacing passes, or fix the pacing in its harness script |
| `typed-under`                                              | Move the pointer off the field before the first key in the harness script, then film the beat again        |
| `stall`                                                    | Film the beat again, and read `harness.md` when the same stall films twice                                 |
| `no-track`                                                 | Rebuild the track with the `canon take camera` command the `message` names, then check again               |
| `ffmpeg-missing`                                           | Report it to the operator and stop, since the stall rule refuses a beat it cannot read rather than pass it |
| Any other `reason`                                         | Report the `reason`, `beat`, and `message` to the operator and stop                                        |

Check a sped-up track by passing its file as `--camera <name>`, since its zooms play on the faster clock a viewer sees.

## The look

The reel draws one pointer on every beat a hand drives, in the look Frameboard's launch film used.

- The cursor is one dark arrow outlined in white over a soft drop shadow, 56 px on a 1920-wide output and scaled with the output's width
- A press draws a `#2f7bf0` ring that grows from 0.4 of its size and fades as it grows, the same ring for a right press as a left one
- The arrow never changes shape over a link or a field, since the log records no page cursor and a guessed one flickers

A launch composition draws the same look, which `handoff.md` states with the track fields it reads.

## Rules for a beat writer

- Let the engine pace the beat. A `wait` covers a result that animates or loads, never a pause before a press.
- Keep a cluster of presses in one area in one beat, since the camera holds one zoom across them
- Film a far jump as one beat when the viewer should follow it, since the camera pans with the cursor
- Show a result away from the press with a `move` carrying `hold` onto it, so the cursor leads the camera there
- Set `"push": false` on a beat whose change covers the whole page, such as a theme switch or a layout change

Set `"hand": false` on a beat no person drives, such as an agent editing the page. Its steps still run and log, and the camera holds wide with no cursor. A cursorless zoom onto an agent's edit read as fake when the operator watched one, so a result too small to read wide takes a hand beat with a glide onto it instead.

## Sources

The scenarios, the pace, and the look come from the takes the operator judged and from Frameboard's launch film.

| Rule                          | Source                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| The scenarios and their calls | Eleven takes of the page above, each judged by the operator on a rendered view          |
| The pace                      | Side by side renders at 300 and 600 ms floors, and at a 300 and a 450 ms rest on a fill |
| The look                      | Frameboard's launch film, whose ring and arrow the operator picked for every reel       |
| No cursorless zoom            | The same film, where a zoom onto an agent's edit with no cursor read as fake            |

The zoom rules come from a recorder's guide, a fixture page, and the same film.

| Rule                          | Source                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Zoom on a click               | Screen Studio's [auto zoom guide](https://screen.studio/guide/auto-zoom) keys its zoom on click positions        |
| The push riding the glide     | The operator judged renders of a fixture page by eye and kept a zoom landing with the cursor over one leading it |
| The cursor leading the camera | Frameboard's launch film, whose operator flagged every push the drawn cursor did not lead                        |
| A visible entry point         | Frameboard's launch film, where a hand edit reached with no visible click cost a composed round and a refilm     |
| One track per take            | Frameboard's launch film, where tracks left from an earlier take drove two beats off sync                        |
