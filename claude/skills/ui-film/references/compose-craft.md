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
- Frame the shape by cropping a window of the page at 1x, never by scaling the 16:9 frame into it, since a page shrunk into a square leaves the action too small to read
- Pan the window along the camera track's view center, so it follows the action the zoom would have aimed at. Frameboard's square cut used a 1080x1080 window.
- Expect a screencast take to hold at 1x from a softer 1080p source, while a stepped take gives the same window two clip pixels per page pixel

## The README loop

Cut a README loop only when the operator asks for one. A README hero plays inline and silently, so it is a short loop rather than a cut of the film.

- Cut it from the raw take showing the app's core action, rather than from a render, in the workspace folder `handoff.md` names for it
- Crop it to the canvas, so no browser margin or page chrome outside the app shows
- End it on the finished state, held long enough to read before the loop restarts
- Export an animated WebP under about 2 MB, since a README renders one inline where a video needs a player. Frameboard's loop played inline at 1.72 MB.

## Sped-up clips

A clip the edit plays faster runs its zoom faster too, so a push that settled in real time pumps several times a beat.

- Rebuild the beat's track for the playback rate with `canon take camera <dir>/log.json --rate <n> --out <file>`, and drive the wrapper from that file rather than from `camera.json`
- Never scale `camera.json`'s times by hand, since the rebuilt track also keeps each push inside the 1 s ceiling at the new speed
- Keep a typing beat at a rate where each word still reads, since a viewer cannot read a fill that finishes in a few frames

## Storyboard headings

- Write each frame heading as `## Frame N: title`, since the dash form in HyperFrames' `storyboard-format.md` example fails the markdown audit
- Treat the parser's read of the colon form as assumed, since its lenient parse was not confirmed against its source
- Title each frame as the beat the operator approved, so the frame, the take's folder, and the caption share one name a reader can follow across all three

## The workspace README

Step 5 writes the filming half of `.canon/video/<slug>/README.md`. The composing session adds its own half under its own heading.

- Add how to re-render each project the workspace holds, naming its folder and the render command it runs
- Name any track rebuilt with `--rate`, with the command that rebuilt it, since a re-film overwrites `camera.json` and leaves a rebuilt track stale
- Leave the filming half as Step 5 wrote it, so the next session can re-film without reading the composition

## Sources

| Rule                        | Source                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------- |
| Caption placement and scrim | HyperFrames' `captions.md`, adjusted for footage with chrome along its bottom edge                       |
| A new project per shape     | `hyperframes-studio`'s brief step, which starts a new project for a different aspect                     |
| The 1080x1080 window        | Frameboard's launch film, cut square from stepped takes                                                  |
| The 2 MB WebP loop          | Frameboard's README hero, an animated WebP cut from a raw take, which played inline at 1.72 MB           |
| Rebuilding a sped-up track  | `canon take camera --help`, whose `--rate` divides every time in the log                                 |
| Storyboard heading form     | HyperFrames' `storyboard-format.md` and the markdown audit's character bans, with the colon read assumed |
| The README's two halves     | Frameboard's workspace, whose README recorded how to re-film and re-render after a session ended         |
