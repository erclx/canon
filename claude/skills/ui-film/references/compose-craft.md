---
title: Compose craft
description: The footage rules a session composing ui-film takes follows where the HyperFrames skills say nothing, being captions over app UI, other shapes, the README loop, sped-up clips, storyboard headings, and the workspace README
---

# Compose craft

Read at Step 5 of `ui-film`, and by the session that composes the takes, which the handoff's next line points here. HyperFrames owns composing, captioning, and rendering, so this file carries only what app footage changes about its advice and restates none of it.

Each rule states the principle. Where a number appears, it is the case measured on one app's launch film, not a law for the next app.

## Contents

- [Captions over app footage](#captions-over-app-footage)
- [Other shapes](#other-shapes)
- [The README loop](#the-readme-loop)
- [Sped-up clips](#sped-up-clips)
- [Storyboard headings](#storyboard-headings)
- [The workspace README](#the-workspace-readme)
- [Sources](#sources)

## Captions over app footage

HyperFrames' caption guide places a landscape caption 80 to 120 px from the bottom and keeps it off a speaker's face. App footage has no speaker, and its bottom edge is often a toolbar where the beat's click lands.

- Pick one caption position for the whole film, clear of the app's chrome where actions land, and keep every caption there, since a caption that moves between beats makes the viewer hunt for it
- Back a caption over bright UI with the scrim HyperFrames' caption guide sizes to the text
- Snapshot each caption's moment, and move a caption only when it covers its own beat's action
- Write caption text by the interface copy rules in `ui-craft`'s `copy.md`, so a caption ends with no period

## Other shapes

Cut a square or vertical version only when the operator asks for one. A film with one shape needs nothing from this section, and the vertical caption band and safe boxes stay with HyperFrames' frame presets.

- Start each shape as its own HyperFrames project, as `hyperframes-studio` states for a different aspect, in the workspace folder `handoff.md` names for it
- Crop a window of the 1920x1080 page around each beat's action rather than letterboxing the page, since a page shrunk into a square leaves the action too small to read
- Size the window to the action's region rather than to a fixed number. Frameboard's square cut used a 1080x1080 window.
- Aim the window at the region the camera track already zooms toward, and drive it from the same track, so the crop and the zoom agree on where the action is
- Expect a screencast take to hold only at 1x in a cropped window, since its clip has one pixel per page pixel. A stepped take is 4K, so the same window still has room to zoom.

## The README loop

A README hero plays inline and silently, so it is a short loop rather than a cut of the film.

- Compose it as its own project in the workspace folder `handoff.md` names for it, from one or two takes showing the app's core action
- Keep it under about 2 MB, since a larger file loads slowly or not at all where a README renders. Frameboard's loop played inline at 1.72 MB.
- Carry no caption the loop depends on and no sound, since a README plays it muted with no controls
- Match the loop's last frame to its first, so the seam reads as a cut back to the start rather than a jump

## Sped-up clips

A clip the edit plays faster runs its zoom faster too, so a push that settled in real time pumps several times a beat.

- Rebuild the beat's track for the playback rate with `canon take camera <dir>/log.json --rate <n> --out <file>`, and drive the wrapper from that file rather than from `camera.json`
- Never scale `camera.json`'s times by hand, since the rebuilt track also keeps each push inside the 1 s ceiling at the new speed
- Keep a typing beat at a rate where each word still reads, since a viewer cannot read a fill that finishes in a few frames

## Storyboard headings

- Write each frame heading in the form HyperFrames' `storyboard-format.md` parses, since a heading in any other form drops the frame from the parsed manifest with only a warning
- Title each frame as the beat the operator approved, so the frame, the take's folder, and the caption share one name a reader can follow across all three

## The workspace README

Step 5 writes the filming half of `.canon/video/<slug>/README.md`. The composing session adds its own half under its own heading.

- Add how to re-render each shape and the loop, naming each project folder and the render command it runs
- Name any track rebuilt with `--rate`, with the command that rebuilt it, since a re-film overwrites `camera.json` and leaves a rebuilt track stale
- Leave the filming half as Step 5 wrote it, so the next session can re-film without reading the composition

## Sources

| Rule                        | Source                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| Caption placement and scrim | HyperFrames' `captions.md`, adjusted for footage with chrome along its bottom edge               |
| A new project per shape     | `hyperframes-studio`'s brief step, which starts a new project for a different aspect             |
| The 1080x1080 window        | Frameboard's launch film, cut square from stepped takes                                          |
| The 2 MB loop               | Frameboard's README hero, which played inline at 1.72 MB                                         |
| Rebuilding a sped-up track  | `canon take camera --help`, whose `--rate` divides every time in the log                         |
| Storyboard heading form     | HyperFrames' `storyboard-format.md`, whose parser records an unmatched heading as a warning      |
| The README's two halves     | Frameboard's workspace, whose README recorded how to re-film and re-render after a session ended |
