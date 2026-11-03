---
title: Compose craft
description: The footage rules a session composing ui-film takes follows where the HyperFrames skills say nothing, being captions over app UI, other shapes, the README loop, pacing, sped-up clips, transitions, reviewing a cut, music, storyboard headings, and the workspace README
---

# Compose craft

Read at Step 5 of `ui-film`, and by the session that composes the takes, which the handoff's next line points here. HyperFrames owns composing, captioning, and rendering, so this file carries only what app footage changes about its advice and restates none of it.

Each rule states the principle. Where a number appears, it is the case measured on one app's launch film, not a law for the next app.

## Contents

- [Captions over app footage](#captions-over-app-footage)
- [Other shapes](#other-shapes)
- [The README loop](#the-readme-loop)
- [Pacing](#pacing)
- [Sped-up clips](#sped-up-clips)
- [Transitions](#transitions)
- [Reviewing a cut](#reviewing-a-cut)
- [Music](#music)
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

- Start each shape as its own HyperFrames project, in the workspace folder `handoff.md` names for it. The `hyperframes` skill's `types/vertical.md` recomposes a vertical film rather than squeezing one.
- Frame the shape by cropping a window of the page at 1x, never by scaling the 16:9 frame into it, since a page shrunk into a square leaves the action too small to read
- Pan the window along the camera track's view center, so it follows the action the zoom would have aimed at. Frameboard's square cut used a 1080x1080 window.
- Expect a screencast take to hold at 1x from a softer 1080p source, while a stepped take gives the same window two clip pixels per page pixel

## The README loop

Cut a README loop only when the operator asks for one. A README hero plays inline and silently, so it is a short loop rather than a cut of the film.

- Cut it from the raw take showing the app's core action, rather than from a render, in the workspace folder `handoff.md` names for it
- Crop it to the canvas, so no browser margin or page chrome outside the app shows
- End it on the finished state, held long enough to read before the loop restarts
- Export an animated WebP under about 2 MB, since a README renders one inline where a video needs a player. Frameboard's loop played inline at 1.72 MB.

## Pacing

A cut paced at one rate throughout reads rushed where the viewer reads and slow where an agent works. Frameboard's launch film read rushed with hand actions at 1.25x to 1.42x, read slow at about 1x everywhere, and landed at about 78 s with the rates split by beat kind.

### Rates by beat kind

Set each beat's playback rate by what the viewer does during it.

- Play an agent replay montage faster than a hand action, since the viewer follows its result rather than each step. Frameboard's ran up to about 2x.
- Play hand actions and anything read near real time, as Frameboard's did at about 1.0x to 1.2x
- Hold a typing beat to the rate `## Sped-up clips` gives, whatever rate the rest of its scene takes

### Holds

Every result and every line of text holds still long enough to land before the cut.

- Hold each result on screen before the cut, such as a recolored button or an agent's reply. About 1 to 2 s fit Frameboard's film.
- Hold text by its length, with HyperFrames' `line_unread` warning as the floor. One short terminal line fit at about 1.5 s on Frameboard's film, where 0.75 s was missed and 2.9 s dragged.
- Pause after a mode switch, such as arming a tool, before the next action, or the switch does not register. About 1 s fit Frameboard's film.

### Windows from marks

Read each scene's window off the take's `log.json`, from its first event less a lead to its last result plus that result's hold, then set the rate from the scene's length. Reusing an old cut's offsets against a new take lands the camera on moments that moved.

## Sped-up clips

A clip the edit plays faster runs its zoom faster too, so a push that settled in real time pumps several times a beat.

- Rebuild the beat's track for the playback rate with `canon take camera <dir>/log.json --rate <n> --out <file>`, and drive the wrapper from that file rather than from `camera.json`
- Never scale `camera.json`'s times by hand, since the rebuilt track also times each push to its glide on the new clock
- Keep a typing beat at a rate where each word still reads, since a viewer cannot read a fill that finishes in a few frames

## Transitions

HyperFrames owns transitions in general. App footage changes one thing, since only canon's camera zooms the footage under a dissolve.

- Settle a zoomed scene back to the whole page before a dissolve into another shot of the same app, so the dissolve blends two matching wide shots rather than ghosting one app at two scales
- Ease the camera wrapper out over the scene's last stretch rather than cutting its scale, as Frameboard's film did over about 0.8 s ahead of a 0.45 s dissolve

## Reviewing a cut

Stills at beat midpoints pass a cut whose motion is wrong, as they passed every cut on Frameboard's film that the operator then rejected for its motion. Review motion before showing the cut, beside the review HyperFrames' `review.md` runs.

- Step a dense frame strip with `snapshot --range START,END --frames 8` around every take's action and every transition, rather than only the hero move `review.md` names
- Check the drawn cursor against the element it acts on in each strip, since the cursor is drawn from the log and nothing but a look shows it leaving what the page moved

## Music

HyperFrames owns the soundtrack, so score the film by its `sound.md` and `film.md`. On Frameboard's launch film the music faults hid in the first 2 s and the last 10 s, being a silent lead and a drop that landed early, which is one film's case rather than a rule.

## Storyboard headings

- Write each frame heading as `## Frame N: title`, since the dash form in HyperFrames' `storyboard-format.md` example fails the markdown audit
- Treat the parser's read of the colon form as assumed, since its lenient parse was not confirmed against its source
- Title each frame as the beat the operator approved, so the frame, the take's folder, and the caption share one name a reader can follow across all three

## The workspace README

Step 5 writes the filming half of `.canon/video/<slug>/README.md`. The composing session adds its own half under its own heading.

- Add how to re-render each project the workspace holds, naming its folder and the render command it runs
- Name any track rebuilt with `--rate`, with the command that rebuilt it, since a re-film overwrites `camera.json` and leaves a rebuilt track stale
- Delete the pass renders once the delivery render is approved, and name the one render kept for each delivered cut
- Leave the filming half as Step 5 wrote it, so the next session can re-film without reading the composition

## Sources

The rules measured on Frameboard's launch film carry its case beside them rather than a default.

| Rule                      | Source                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| The 1080x1080 window      | Frameboard's launch film, cut square from stepped takes                                             |
| Rates, holds, and windows | Frameboard's launch film, cut at three paces before about 78 s landed                               |
| Settling wide             | Frameboard's launch film, whose dissolves ghosted two boards at different scales until each settled |
| Where music faults hide   | Frameboard's launch film, which opened silent and ended over near silence                           |

The rest come from HyperFrames, the verb, or Frameboard's other deliverables.

| Rule                        | Source                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| Caption placement and scrim | HyperFrames' `captions.md`, adjusted for footage with chrome along its bottom edge                        |
| A new project per shape     | The `hyperframes` skill's `types/vertical.md`, which recomposes a vertical film rather than squeezing it  |
| The 2 MB WebP loop          | Frameboard's README hero, an animated WebP cut from a raw take, which played inline at 1.72 MB            |
| Reviewing motion            | HyperFrames' `review.md`, widened to every action after midpoint stills passed cuts the operator rejected |
| Rebuilding a sped-up track  | `canon take camera --help`, whose `--rate` divides every time in the log                                  |
| Storyboard heading form     | HyperFrames' `storyboard-format.md` and the markdown audit's character bans, with the colon read assumed  |
| The README's two halves     | Frameboard's workspace, whose README recorded how to re-film and re-render after a session ended          |
