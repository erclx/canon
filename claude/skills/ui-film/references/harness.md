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
- [The page](#the-page)
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

## The page

A headless browser answers some page requests in ways a take cannot film, and `canon take` stubs them on both its routes. A harness drives its own browser, so it installs the same stub before the page loads.

- Answer `requestFullscreen` without resizing the window. Headless Chromium paints a real request at its 800x600 default screen, so a 1920x1080 screencast films that corner.
- Answer `requestPointerLock` as a no-op, since a pointer-locked scrub closed the headless page mid-take on one app's film
- Keep the window unchanged, so a style keyed on `:fullscreen`, which only a real request sets, stays off

```js
await context.addInitScript(() => {
  let held = null
  const changed = (el) =>
    queueMicrotask(() =>
      (el.isConnected ? el : document).dispatchEvent(
        new Event('fullscreenchange', { bubbles: true, composed: true }),
      ),
    )
  Object.defineProperty(Document.prototype, 'fullscreenElement', {
    configurable: true,
    get: () => held,
  })
  Object.defineProperty(Document.prototype, 'fullscreenEnabled', {
    configurable: true,
    get: () => true,
  })
  Element.prototype.requestFullscreen = function () {
    held = this
    changed(this)
    return Promise.resolve()
  }
  Document.prototype.exitFullscreen = function () {
    if (held === null)
      return Promise.reject(new TypeError('Not in fullscreen mode'))
    const left = held
    held = null
    changed(left)
    return Promise.resolve()
  }
  Element.prototype.requestPointerLock = function () {
    return Promise.resolve()
  }
})
```

### Where the still comes from

A take's `still.jpg` is the check Step 4 reads, so it has to show what the clip filmed. `page.screenshot` captures the window rather than the screencast, and on that app's film it showed the full slide while the clip held the 800x600 corner.

- Write `still.jpg` from the clip's closing frame, the frame the verb's own still shows: `ffmpeg -v error -y -sseof -1 -i <dir>/clip.mp4 -update 1 -q:v 2 <dir>/still.jpg`
- Never take the still from the page, since a page capture and a clip frame can disagree and only the clip reaches the edit

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
- Write one `move` event per glide, its `points` holding every position sent with its clip time, so the drawn cursor matches what the page received rather than an eased curve
- Read each time off the clip's clock as the position goes out, never from a hand estimate. Estimated drag times ran about 0.8 s ahead of the real drag on one app's film.
- Pace a drag in small steps and wait on each, since a burst of moves lags the page. About 30 steps a second kept Frameboard's divider within 2 px of the cursor.

### One drag helper

Route every drag through one helper, so each logs the same way.

- Press on the control that moves, such as a slider's thumb, at a position computed from its value, never on its track, since a press on the track jumps the value before the drag starts
- Log the press, the glide's `points`, and the release from inside the helper, as the events go out

## Sources

The route comes from the verb's help, and the script, server, and step rules from Frameboard's launch film.

| Rule                           | Source                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| The route                      | `canon take --help` and `canon take camera --help`, whose log shape a harness writes                   |
| Agent calls and typing clock   | Frameboard's launch film, whose harness froze on a synchronous call and stalled on `pressSequentially` |
| Restore, readiness, and helper | Frameboard's launch film, refilmed for a stray change notice, a missing control, and a crashed helper  |
| Targets and re-checked steps   | Frameboard's launch film, whose recorded steps broke when a token list changed between versions        |
| Holding a last frame           | FFmpeg's [`tpad` filter](https://ffmpeg.org/ffmpeg-filters.html#tpad), used on Frameboard's film       |

The page and log rules come from the verb's own behavior and from a second app's present mode.

| Rule                           | Source                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `ms` and `points` on the log   | The `type` and `move` events `canon take` writes, which the camera and the drawn cursor read           |
| Paced drags                    | Frameboard's split compare, whose divider lagged a burst of moves until each step was paced and logged |
| Measured times and drag helper | A launch film whose hand-timed drag log ran ahead of the drag, per the verb's own `move` events        |
| Fullscreen and pointer lock    | A launch film whose present mode filmed an 800x600 corner, matching the stub `canon take` installs     |
| The still from the clip        | The same film, whose `page.screenshot` still passed a clip holding the corner                          |
