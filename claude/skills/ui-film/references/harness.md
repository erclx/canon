---
title: Harness
description: The route a beat takes when canon take cannot drive it, and the harness faults that cost a launch film most of its refilms, each with its source
---

# Harness

Read at Step 3 of `ui-film` when a beat takes the harness route. A harness fault looks like a flaky take, so a session that has not read these refilms on a guess instead of fixing the cause.

Each rule states the principle. Where a number appears, it is the case measured on one app's launch film, not a default for the next app.

## Contents

- [The route](#the-route)
- [The script](#the-script)
- [The server](#the-server)
- [The steps](#the-steps)
- [The log](#the-log)
- [Sources](#sources)

## The route

A beat driven from outside the page, such as a drag between two windows or an input the step kinds lack, cannot run as `canon take` steps. Until the verb can run an outside script itself, film it through a harness.

- Keep each script in the workspace's `harness/` folder and write its output into the take's own folder, never at the workspace root
- Drive the beat from a Playwright script that records the page and writes a log in the shape of a take's `log.json`
- Build its camera track from that log with `canon take camera <log> --out <file>`, so the composition applies it like any other take
- Tell the operator which beats ran this way, since their clips carry the harness's resolution rather than the stepper's

## The script

A harness runs the page and whatever acts on it in one script, so anything that blocks the script freezes the take wherever it lands.

- Run a scripted agent's calls, such as a CLI it shells out to, asynchronously, since a synchronous call blocks the process driving Playwright and freezes the take mid-typing or between two clicks
- Type one character at a time on a fixed clock rather than through `locator.pressSequentially`, which stalled 3.6 s mid-note on Frameboard's launch film while a fixed clock held at 7 ms or less a key
- Hold a clip's last frame with FFmpeg's `tpad` when a long take ends before its scene needs it, since a held frame is invisible only while nothing on screen moves

## The server

A harness beat often starts its own server or restores the app's state, and both race the beat when the order is wrong.

- Restore the app's state before a fresh serve, never while the server runs, since a running app logs the restore as a change and can show it on camera, as a stray change notice did on Frameboard's film
- Wait until the fresh server answers before the beat's setup writes anything, since a server that misses the setup write never shows the control under test
- Keep a local helper the harness calls, such as one that mints edit links, up across server restarts, answering 503 while no server runs rather than crashing on the next request

## The steps

A recorded harness step goes stale when the app changes under it, and nothing refuses it the way `canon take` refuses `target-missing`.

- Target each control by its name, such as its role and label, never by its position, since a position finds whatever sits there after a change
- Re-check each recorded step against the current build before filming, since a token list that began closing on pick made Frameboard's old closing click reopen it

## The log

The edit draws the cursor and aims the camera from the log alone, so a harness log carries the fields the stepper writes for the same events.

- Write `ms` on each `type` event as the measured length of the burst, since a camera guessing at 45 ms a character released its zoom halfway through a 5.7 s note on Frameboard's film
- Write `points` on each `move` event, being every position sent with its clip time, so the drawn cursor matches what the page received rather than an eased curve the page never saw
- Pace a drag in small steps, wait on each, and log each step as its own linear move, since easing each step stutters. About 30 steps a second kept Frameboard's divider within 2 px of the cursor.

## Sources

| Rule                           | Source                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| The route                      | `canon take --help` and `canon take camera --help`, whose log shape a harness writes                   |
| Agent calls and typing clock   | Frameboard's launch film, whose harness froze on a synchronous call and stalled on `pressSequentially` |
| Restore, readiness, and helper | Frameboard's launch film, refilmed for a stray change notice, a missing control, and a crashed helper  |
| Targets and re-checked steps   | Frameboard's launch film, whose recorded steps broke when a token list changed between versions        |
| `ms` and `points` on the log   | The `type` and `move` events `canon take` writes, which the camera and the drawn cursor read           |
| Paced drags                    | Frameboard's split compare, whose divider lagged a burst of moves until each step was paced and logged |
| Holding a last frame           | FFmpeg's [`tpad` filter](https://ffmpeg.org/ffmpeg-filters.html#tpad), used on Frameboard's film       |
