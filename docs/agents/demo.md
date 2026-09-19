---
title: Demo
description: Compiling a screencast draft into a runnable plan, driving a served application to a recording and a still, reading numbered frames back out of a recording, the pointer the recording paints, and what each refusal reports
---

# Demo

`canon demo` drives a project's running application and writes a recording of what it did, plus a still frame of the same run. It exists so a project card and a short demo stop depending on someone sitting down to record one by hand.

Two verbs, and they are separate because the artifact between them is edited.

```bash
canon demo compile .canon/tmp/screencast/inline-edit.md
canon demo run demos/inline-edit.json
canon demo run demos/inline-edit.json --cursor ~/cursors/theme --out assets
canon demo frames demos/inline-edit.webm --fps 2
```

## The draft and the plan are different files

`draft-screencast` drafts beats for a person. A beat carries what is on screen, one verb, what to watch for, an emphasis, and a caption, and none of that names a selector, a URL, a wait condition, or a timing. Those four are what an executor needs and what would ruin the draft, since the format is pre-seeded so the operator edits down rather than fills blanks.

So `canon demo compile` writes a second artifact rather than adding fields to a beat. It maps each beat's verb to a step, seeds the timing, marks which beat the still comes from, and leaves the target and the URL empty for a person to fill. The report names every field it could not supply.

The plan is committed, not scratch. Its timing is a starting point tuned by watching a recording, and the draft cannot reproduce a tuned value, so a recompile over an existing plan refuses and names `--force`.

A plan can carry an optional `colorScheme` of `light` or `dark`, which the recording context starts in so a page following the system preference paints that scheme with no click beat of its own. An absent field keeps the engine's default, which is light, and `compile` never seeds it. Any other value makes the plan unreadable. A page keyed on a stored theme rather than the preference ignores the field.

`record-screencast` is the routed way to run both verbs from a draft path: it compiles only when no plan exists yet, then runs, stopping to report any field still unresolved rather than guessing one.

| Option          | Behavior                                                          |
| --------------- | ----------------------------------------------------------------- |
| `--out <dir>`   | Directory the plan and its output paths point at, default `demos` |
| `--slug <slug>` | Plan name, defaulting to the draft filename                       |
| `--force`       | Overwrite an existing plan, losing any timing tuned by hand       |
| `--json`        | Add a record on stdout carrying the beats and what is unfilled    |

## What a run does

`canon demo run` reads the plan, refuses if a field is still empty, and drives the application the plan's URL names. It records the whole run to `webm` and writes the still from the beat the draft calls the hero, falling back to the last beat, since a demo's final state is the payoff and a cold open is usually an empty screen.

A step's caption from the draft renders as an overlay while its hold plays, so the narration a person wrote is what shows on screen rather than the name of the action the engine performed.

When `ffmpeg` is on PATH, the run also writes an mp4 beside the webm, since webm plays in a `<video>` tag but nothing else accepts it. A target without `ffmpeg` still gets the webm and a line naming what to install, and the run does not fail over the missing converter.

`--gif` adds a third file from the same converter, and it is opt-in where the mp4 is not. A gif runs several times the size of the webm it derives from, and the destination that needs one is a README on a host that strips `<video>`, which GitHub does. The filter generates a palette from the source and then applies it, rather than quantizing per frame, since a per-frame palette is what makes a recording of flat interface colors band and shimmer. It applies that palette without dithering, because the command records applications rather than photographs and the dither writes noise the encoder then stores. One recording measured 3,193,715 bytes dithered against 2,701,941 without, with the same text region cropped from both and read as identical. A missing converter is reported the same way it is for the mp4, so an absent `ffmpeg` costs the gif and not the run.

| Option           | Behavior                                                            |
| ---------------- | ------------------------------------------------------------------- |
| `--out <dir>`    | Directory to write into, overriding what the plan names             |
| `--cursor <dir>` | Cursor theme folder to draw the pointer from                        |
| `--no-video`     | Write only the still                                                |
| `--no-still`     | Write only the recording                                            |
| `--gif`          | Also write a gif, for a host that strips video                      |
| `--json`         | Add a record on stdout carrying every path written and the duration |

A step waits on its `waitFor` selector becoming visible and then holds for its own `holdMs`, which is what puts a finished state on screen long enough to read. `navigate` uses the plan's URL unless the step names its own.

## What frames does

`canon demo frames` pulls numbered PNG stills back out of a recorded video through the same `ffmpeg` binary the mp4 and gif conversion already shells to. Nothing reads a recording back today, so a broken one ships until a person opens it, and this verb is what a skill calls to read one instead. It writes one frame a second by default, sampling at a rate matched to how long a tuned recording runs rather than at a rate tuned for any one clip. Frames land beside the video by default, named `<video-basename>-frame-<NNN>.png`, so they fall under the same `demos/*.png` gitignore entry the still already uses.

| Option            | Behavior                                                 |
| ----------------- | -------------------------------------------------------- |
| `-o, --out <dir>` | Directory to write frames into, default beside the video |
| `--fps <n>`       | Frames extracted per second of video, default `1`        |
| `--json`          | Add a record on stdout carrying every frame path written |

`read-frames` is the routed way to call this verb and read the frames back: it runs the verb, reads each returned frame with the Read tool, and reports one plain description per frame. It never renders a verdict, since a frame read is evidence a person weighs rather than a pass or fail this toolkit states on their behalf.

## The pointer is painted inside the page

The browser engine offers an annotation of its own that draws a dot on the interacted element and a title naming the API call it made, and this recorder does not turn it on. It paints no cursor, so a run relying on it looks like the pointer teleports between targets, and the two overlays below supersede it: a real cursor where the dot is a marker, and the beat's narration where the title reads `Mouse move`. Running both put four overlays on the frame, and the two the engine drew were the two a viewer reads as noise.

The recorder injects a pointer element before navigation and moves it through the engine's pointer with interpolated steps rather than through the element-clicking helper, which resolves a target and jumps to it. The step count is the whole difference between a cursor that travels and one that appears, and how many steps a move takes is derived from the machine's own round-trip cost rather than fixed, so the same plan glides at roughly the same pace on a loaded machine as an idle one. It also reads the element under it on every move and switches between an arrow, a hand, and a text beam, so it reflects the page the way a real cursor does.

`--cursor` points at a folder of Windows cursor resources and the browser decodes them directly, with no conversion step and no image tooling. Each resource carries a hotspot per size, and the largest entry's hotspot scaled to the drawn size is what puts the artwork's tip where the click lands. A theme contributes per state, so a folder holding an arrow and no hand still supplies its arrow and the bundled artwork covers the rest.

Three of the nineteen states a theme carries are read. A drag, a resize, or a wait shows the arrow where a real session would show something else, and the two animated states have no still frame to draw.

## What the refusals report

Every refusal exits 1 and names its reason in the `--json` record, so a skill branches on `reason` rather than on the exit code.

| Reason                | What happened                                                                       |
| --------------------- | ----------------------------------------------------------------------------------- |
| `draft-missing`       | No file at the path given to `compile`                                              |
| `draft-unreadable`    | The draft carries no beat sheet, or a sheet with no beats                           |
| `plan-exists`         | A plan is already there and `--force` was not passed                                |
| `plan-unresolved`     | A URL or a target is still empty, named field by field                              |
| `no-output-requested` | `--no-video` and `--no-still` together, which would drive the app and write nothing |
| `plan-unreadable`     | The plan is not JSON, or a step names a kind nothing drives                         |
| `browser-missing`     | The browser binary is not installed, with `install` carrying the command            |
| `engine-missing`      | The browser package itself did not resolve                                          |
| `video-missing`       | No file at the path given to `frames`                                               |
| `converter-missing`   | `ffmpeg` is not on PATH, so `frames` extracted nothing                              |
| `extraction-failed`   | `ffmpeg` exited non-zero, with `message` carrying its stderr                        |

## The browser reaches every target

This command was the first browser command to ship, and `canon capture` has since joined it. Capture was held back because its only caller was this repository regenerating its own committed images, which was a fact about that caller rather than about the render.

The cost is stated rather than hidden: the browser binary installs separately, so a target runs `bunx playwright install chromium` once before a recording works at all. A run that cannot launch reports that command inside the frame and exits 1.

## What it does not do

A generated recording is a raw take. Nothing trims it or scores it beyond the caption each beat already carries.

It also does not replace a narrated screencast. That has a hero moment, a cut list, and a voice, none of which survives being generated. This answers the case where the alternative is recording nothing.
