---
title: Teach
description: The learning workspace domain, the canon teach verbs, the chrome and page kinds they splice and render, and the committed fixture
---

# Teach

## Overview

A learning workspace is a folder of standalone HTML lessons a learner opens directly, with a mission, a glossary, resource pages, and learning records beside them. `canon teach` opens a workspace, resolves what a lesson needs, seeds a stylesheet from the design tokens, and splices navigation chrome into every lesson.

`claude/skills/teach-workspace/references/teach.md` fixes the artifact and `glossary.md` beside it fixes the glossary. The `teach-workspace` skill decides what to teach next. Start from `canon teach --help`.

## Layout

### `src/teach/`

Reads a workspace, resolves lessons, renders the lesson body, and splices the chrome.

- A workspace is `<nn>-<topic>`, so a listing sorts by when each opened, and one with no `MISSION.md` lists as a disabled `Stub` row
- `teach lesson` writes nothing. It reports the numbered path, the stylesheet, the mission's success lines, and one drawn quiz order per question, so the author never picks it.
- `teach nav` rewrites each lesson between four marker pairs, `style`, `header`, `footnav`, and `scripts`, and refuses a lesson missing one
- `nav` leaves the heading, lede, body, and quiz alone apart from a `<main>` wrap and a link on each "lesson NNNN" mention, which it re-points after a rename and unwraps when the number stops resolving
- `nav` also regenerates the root listing, the contents pages, and each `reference/<slug>.md` as an escaped, highlighted `.html` sibling, writing only what changed

### `src/teach/browser/`

The typed modules a page's scripts are built from, and the chrome behavior they carry.

- `compileScript` transpiles a module without bundling, so it runs only its own source, takes values as JSON arguments, and gets a shared function as a helper declared ahead of it
- The scripts cover the theme, the sidebar's width, state, and outline focus line, menu dismissal, the glossary filter, and the button quiz
- `canon teach up` splices the live reload in at serve time and never writes it to a page
- A radio quiz is gated by CSS inside `@supports selector(:has(*))`, and a lesson holding both quiz shapes hides every question past the first
- The root and contents pages open with the sidebar shut and lesson pages open it above 1100 pixels, with an overlay below that holding focus until Escape, the scrim, or its close control

### `examples/teach/`

The committed fixture workspaces, with the chrome stylesheet and the captures a reader of the examples sees.

- `00-fixture/` is the workspace development renders against, `01-sparse/` is a thin one, and `02-unopened/` is the `Stub` case
- A fixture command takes `--root examples/teach`, and a root already named `teach` is taken as the teach folder itself
- Regenerate with `bun src/cli.ts teach ...`, never an installed `canon`, which carries older components and reverts a newer change silently
- A change needing only the chrome stylesheet takes `teach stylesheet <topic>`, since `nav` rewrites every page
- Captures sit flat in `evidence/`, from `canon capture <url> -o <png> --selector body` against `canon serve examples/teach --port 8766`

### Other folders

Folders around the verbs own the rendering layer, the live workspaces, and the pedagogy.

- `src/teach/components/` and `src/teach/html/` own the JSX-to-string factory and the components a lesson body renders through, with no React and no build step
- `src/design/` generates every chrome rule from `TEACH_CHROME`, and reading text takes its type scale while teach keeps only the hand-drawn face pair
- `.canon/teach/` holds the operator's live workspaces, gitignored and backed by `canon records push`
- `claude/skills/teach-workspace/` owns the pedagogy, and its promotion handoff is `.canon/tmp/handoff/teach-promotion/<slug>.md`, landed and deleted by its fold mode

## Gotchas

- A hand edit inside a marker pair, or in a generated reference `.html`, is overwritten by the next `nav` with nothing reporting it
- `nav` rewrites `assets/base.css` only where one exists or no `course.css` does, so a legacy workspace with its own `course.css` needs `teach stylesheet <topic>` to take a chrome change
- A bare `canon teach list` reads the operator's live workspaces, and a claim about the fixture needs `--root examples/teach`
- No browser harness reaches a generated teach page, so collapse, resize, filter, focus, and overlay work ships named as untested
- `canon teach up` writes while it serves, so `--root examples/teach` dirties the committed fixture
