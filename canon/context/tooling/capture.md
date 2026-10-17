---
title: Capture and ports
description: The web stack's derived server port, the capture seed layout, evidence frames, the screenshot wrapper teardown, and render determinism
---

# Capture and ports

## Overview

The web layer ships two things a running application needs from its tooling: a server port that cannot collide across worktrees, and a capture harness that shoots the running app into committed evidence. `canon/context/tooling/stacks.md` covers the rest of what the stacks decide.

## Decisions

### A served port derives from the working directory

`scripts/worktree-port.sh` in the web layer prints a base plus an offset hashed from the worktree folder name into a band of 50. Each server-starting script exports it, and every config adds it to the stack default.

A claim file was the alternative and needs a lock. `strictPort` and Playwright's `reuseExistingServer: false` make a collision fail loudly, since a suite reusing whatever answers on the port reports a pass against another branch.

### Leftover worktree folders are refused

A folder left under `.claude/worktrees/` after its worktree was removed is refused rather than served. Git reports the parent repository from inside one, so the linked-worktree test passes it and it derives the main checkout's port, with no signal. Location separates a leftover from an ordinary subdirectory.

A name-derived offset would only move which port collides.

- A folder whose own `.git` was deleted sends git upward into the main-checkout test
- A folder whose `.git` names a pruned administrative directory makes git refuse and lands in the fallback that answers 0 for a plain directory
- The helper walks up for a `.git` file naming a target that is gone, which reaches both

### Manifest call sites guard the helper

Every manifest call site carries a `&& export VAR &&` guard, because the refusal reaches nothing without it. An assignment prefix, `VAR=$(bash scripts/worktree-port.sh) <server>`, discards the exit status of its own substitution, so a refusing helper started the server with `VAR` empty and every config read that as an offset of zero.

- The bare assignment carries the status, the guard reads it, and the export puts the value in the environment the server inherits
- Measured 2026-08-19 under `bun run`, the prefix served 4321 and exited 0, and both guards refused and exited 1
- A target still carrying the old seed keeps the defect until `canon tooling sync web . --write` replaces it, and nothing reports the drift

### The capture seed's output layout

The seed writes a folder per section holding one file per theme, rather than a flat `<name>-<state>.png`. The `ROUTES` and `STATES` consts collapse into one `CASES` record where each entry is one output file.

- A case naming `sections` nests one folder deeper, at `<section>/<name>/<theme>.png`, which `src/pr/evidence.ts` reads as one state group per section
- The flat `<section>/<name>.<theme>.png` would group everything under one block of thirty-odd rows, and the one adopting target had already converged on section folders (measured at `d2c0281c`)
- The seed ships no run-mode set, since the grown target's four modes encode its deployment shape, which does not travel
- The capture crosses every case with four widths, 320, 768, 1280, and 1536, and marks 320 and 1280 as the two a project commits
- Frame names carry the width as `<width>--<theme>.png`, so a target whose `CASES` carried a per-case `width` and `height` meets a shape change on its next sync

### Evidence frames

The sweep under `screenshots/` is gitignored and per worktree, so it partitions by branch for free. A `CaptureCase` flagged `evidence: true` breaks from that: its output under `evidence/` carries no hostname or worktree segment and commits.

- `--require-base-url` skips a flagged case, since a production smoke run should not overwrite the committed baseline with what a live deployment renders
- It exits 1 when the skip leaves zero cases, and the golden template leaves one case unflagged so a fresh scaffold's `smoke:prod` always has a route to check
- A first commit to `evidence/` runs the capture twice with no code change and confirms byte-identical output, which catches a flaky render before it reaches the pull request
- This repository sorts its own `evidence/` folders into dev and prod by location, which `canon/context/development/evidence.md` writes down

### Where server readiness lives

`canon tooling verify` runs `bun run screenshot` in every scaffolded stack declaring it, being `astro` and `nextjs`, then asserts PNGs landed under `screenshots/`. A seed naming one project's selectors therefore fails every other stack's verify unless a selector matching nothing is reported and skipped.

`canon tooling verify web` cannot catch that, since `web` carries no scaffold command.

- Server readiness stays in `scripts/screenshot.sh` rather than the seed
- The wrapper already builds, starts the preview, polls it for ten seconds, and refuses a port in use, so lifting it into TypeScript rewrites working shell with no defect behind it

### The README frame workflow

The web stack ships `readme-screenshot.yml`, which commits a refreshed frame back to the pull request branch, and this repository does not run it. `pr-visual-checks.yml` reports the landing page capture and never commits, because that page reads catalog counts at build time and a merge touching no `web/` file moves its bytes.

A target's README frame moves only when the branch's own files do, which is the test `governance/rules/tooling/ci-workflow.md` states for committing. The cost is a shipped template whose commit-back half the first adopting target verifies, not this repository.

### The surface-capture rule reaches every component

`governance/rules/ui/surface-capture.md` fires on every component file rather than on routes and pages alone, since a component with no capture can carry a real defect unseen. A component the production build strips out, such as a dev-only scaffold switcher, carries its exemption in the rule body rather than sitting outside a narrower glob.

A provider or layout wrapper that renders no surface of its own fires the rule too, which is the accepted cost. Measured at `64a4297b` on 2026-09-07.

## Gotchas

### Two capture tools

`canon capture` and `bun run screenshot` both produce PNGs and overlap nowhere else. `src/capture/render.ts` drives Chromium over static HTML files, while `bun run screenshot` is a web-stack config a target owns that builds, serves, and captures the running application.

### The screenshot wrapper's teardown

`scripts/screenshot.sh`'s `EXIT` trap guards `kill "$PREVIEW_PID"` the way it guards the `wait` beside it, so a successful capture exits 0 whether or not `astro preview`'s detached process has already exited.

- The trap also kills whatever `lsof -ti tcp:"$PREVIEW_PORT"` reports bound, when `lsof` is on `PATH`, and warns and falls back to the pid-only kill otherwise
- Killing by port is safe because the preflight `curl` refuses the run if the port already answers, so anything bound at teardown descends from this run's preview
- The uncovered window sits between that preflight and the trap's installation, during `bun run build`, where a bystander binding the port would be killed
- `src/tooling/screenshot-trap.test.ts` reproduces the pid race and asserts the port is unbound once the script exits, with a kernel-assigned port per case so it never kills another worktree's preview

The test cases run under vitest's default 5000ms timeout and fail on it when the load average sits near 14, then pass on a rerun. A Tests stage failure naming only this file on a loaded machine is timing rather than a regression.

### Render determinism

The render is byte-deterministic within one machine and across runners. Two local captures of one built preview produced all 36 PNGs identical, and two GitHub runners produced the same blobs, readable in `main` at `fa07374d` and `71a5e183`. A difference from the baseline is real content, so the capture job carries no pixel tolerance.

A frame embedding an `iframe` records the fonts of the machine that shot it. The token preview renders in a different fallback sans on two machines when neither has Geist. A frame's own fonts still load after its `readyState` reads complete, so the settle requires `fonts.status` to read `loaded` inside each same-origin frame.

- Read a determinism claim against an artifact from another machine, since a local pair agrees on everything a local cache decides
