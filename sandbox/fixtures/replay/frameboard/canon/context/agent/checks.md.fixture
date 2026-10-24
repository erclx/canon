---
title: Checks
description: The content rules Frameboard enforces, the three paths that run them, and a project's own rules
---

# Checks

## Overview

Owns the content rules and where they run. A frame that breaks one is reported without anyone remembering to check, both to the agent straight after its write and on the frame's label on the board.

## Layout

### `src/server/checks/`

Owns the rules, the cascade they read, and the runner over a frame, a page, or a project. It imports only `src/shared/` and its libraries, so the hook bundles it without the server. While a server runs, the board sheet is the `--tokens` sheet the address file records.

- The `check` verb, the server on every watched batch, and the plugin hook all run `checkFrameIn`, so no path drifts from another
- `check` exits 8 with `check-findings` and the result in the error's details when any finding is an error, so a script branches on the exit alone. A result holding warnings alone exits 0
- Exact rules read the parsed file, being `naming`, `dot-folder`, `head-body`, `table-tbody`, `outside-link`, `network`, and `missing-file`

Selector rules read the cascade rather than the parsed file.

- They are `default-font`, `generic-font`, and `theme`, plus `allowed-fonts` and `uppercase` only when `project.json` sets `checks.allowedFonts` or `checks.noUppercase`
- `theme` passes a `box-shadow` or `text-shadow` whose colors are all black or white at or under 0.2 alpha, since a faint shadow reads the same on either theme
- The cascade matches with css-select, weighs with `@bramus/specificity`, resolves custom properties per element, and reads token sheets ahead of the frame's own

The hook's entry is `src/cli/hook.ts`, bundled to `dist/hook.js` beside the CLI, in the folder `canon/context/agent/cli.md` owns.

- The hook prints `decision: "block"` with the findings as `reason`, which Claude Code places beside the tool result as feedback on that write
- It exits 0 and prints nothing for a non-frame write, a frame outside any board, a file gone since, and stdin that is not JSON, so a write is never reported as failed
- The bundle carries no commander, Hono, chokidar, ws, or zod, and a run cost a median 80 ms on Bun against a bare start of 17 ms. Measured at d609955 on 2026-10-17.

### `src/server/checks/browser/`

Owns the browser tier, the rules that read a rendered page. It sits in its own folder so the hook bundle, which imports `checks/frame.ts` alone, never reaches it or `playwright-core`. Its `viewport` rule reports a warning and the rest report errors, since a full-height screen sizes off the viewport on purpose.

- `checkRendered` opens a frame through capture's `openFrame` at its layout size, in light then dark, with `fonts: 'wait'` so a missing face is measured in the fallback the board shows
- Each rule reports at most one finding per frame, naming the first offending element by its edit index and how many more, and opens with the theme when only one theme trips it
- `clipped` measures the boxes no ancestor crops, so an ellipsis or a crop is no finding, and `scrollbar` takes one pixel of slack
- `viewport` rereads the content at twice the viewport height through `fit`'s `readContentSize`, which leaves out what a cropping ancestor hides, as `clipped` does
- `min-font-size` runs only when `project.json` sets `checks.minFontSize` to a positive number of pixels, and picks text elements the way capture's font check does

The findings the board holds between watch batches, and the warm checker that runs this tier, sit in `src/server/live/`, which `canon/context/board/server.md` owns. Each frame's list is its static findings followed by the browser findings last landed for it, so the client keeps one list per ref.

- The server sends the whole findings map after the board on hello, then a partial map per batch where an empty list clears a frame
- A change to a token sheet rechecks and reloads every frame it reaches, and a change to a project's `project.json` rechecks them without a reload
- `rendered-findings.ts` rechecks one frame at a time on the PNG route's warm browser but its own queue, sweeping every frame at start and after each browser launch
- A batch queues the frames `recheckRefs` names plus every frame whose box or file time changed, since a resize writes `layout.json` alone
- A frame queued again before its result lands drops that result, and a failed recheck lands an empty list, so a label never shows findings from an older file

### `src/server/routes/checks.ts`

Owns `POST /api/checks`, behind the write token, which `check` calls with the refs it read.

- It rescans the board first, queueing a write the watcher has not batched yet, then waits until no recheck of those frames is pending and answers the held browser findings and `browser: { ran: true }`
- A browser that does not launch answers `browser: { ran: false, reason: 'browser-not-found' }` with no findings, so the board says nothing and `check` alone reports it
- `check` with no live server, or one that does not answer in 120 seconds, sets `browser.reason` to `server-not-running` and closes its human output on a line saying so

### Other folders

The plugin side of the hook sits outside `src/`.

- `plugins/frameboard/hooks/` owns `hooks.json` and the `check.sh` resolver the plugin runs after every agent write

## Gotchas

- `frame.ts` holds `checkFrame` apart from the runner in `run.ts`, because the runner reads the board scanner and its zod classic import would double the hook's start
- The browser rules run on the server and never in the hook, so an agent sees them through `check` with a server running and on the board, never in the turn of its write
- Every serve launches Chromium for the startup sweep, so a spec or capture case reading a label count waits on `check` or `POST /api/checks` first, since a browser finding can land mid-assertion
- The browser comparison in `e2e/checks.spec.ts` never sets `color-scheme` itself, since that flips the default text color around a frame's fixed literal color and reads as two themes
- A project rule kind is added only when a real frame needs it, since a config language that grows ahead of need becomes the design tool Frameboard is not
