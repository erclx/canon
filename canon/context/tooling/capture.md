---
title: Capture and ports
description: The web stack's derived server port and the leftover-folder refusal, the capture seed's case record and output layout, evidence frames, the screenshot wrapper's teardown, and render determinism
---

# Capture and ports

## Overview

The web layer ships two things a running application needs from its tooling: a server port that cannot collide across worktrees, and a capture harness that shoots the running app into committed evidence. `canon/context/tooling/stacks.md` covers the rest of what the stacks decide.

## Decisions

### A served port derives from the working directory

`scripts/worktree-port.sh` in the web layer prints a base plus an offset hashed from the worktree folder name into a band of 50. Each server-starting script exports it, and every config adds it to the stack default. A claim file was the alternative and needs a lock. `strictPort` and Playwright's `reuseExistingServer: false` are what make a collision fail loudly, since a suite reusing whatever answers on the port reports a pass against another branch.

A folder left under `.claude/worktrees/` after its worktree was removed is refused rather than served. Git reports the parent repository from inside one, so the test separating a linked worktree from the main checkout passes it and it derives the main checkout's port, with no signal at all where a deliberate collision arrives through `strictPort`. Location is what separates a leftover from an ordinary subdirectory. Handing a leftover the same name-derived offset was the alternative, and it moves which port collides rather than reporting anything.

The two leftover shapes reach the base port through different branches. A folder whose own `.git` was deleted sends git upward into the main-checkout test, and a folder whose `.git` names a pruned administrative directory makes git refuse outright and lands in the fallback that answers 0 for a plain directory. The helper walks up from the working directory for a `.git` file naming a target that is gone, which reaches both.

Every manifest call site carries a `&& export VAR &&` guard, because the refusal reaches nothing without it. An assignment prefix, `VAR=$(bash scripts/worktree-port.sh) <server>`, discards the exit status of its own substitution, so a refusing helper started the server with `VAR` empty and every config read that as an offset of zero. The bare assignment carries the status, the guard reads it, and the export puts the value in the environment the server inherits. Measured 2026-08-19 under `bun run`: the prefix served 4321 and exited 0, and both guards refused and exited 1. A target still carrying the old seed keeps the defect until `canon tooling sync web . --write` replaces it, and nothing reports the drift.

### The capture seed's output layout

The capture seed writes a folder per section holding one file per theme, rather than a flat `<name>-<state>.png`. The `ROUTES` and `STATES` consts collapse into one `CASES` record where each entry is one output file. A case naming `sections` nests one folder deeper, at `<section>/<name>/<theme>.png`, which is the layout `src/pr/evidence.ts` reads as one state group per section. The flat `<section>/<name>.<theme>.png` was the alternative and it groups everything under one block of thirty-odd rows. Measured at `d2c0281c`: the one target that adopted the seed had already converged on section folders split by theme.

The seed ships no run-mode set. The one target that grew this seed carries four modes, and they encode its deployment shape, which is the part that does not travel. The seed ships the output path and the case record and leaves modes per project.

The capture crosses every case with four widths, 320, 768, 1280, and 1536, and marks 320 and 1280 as the two a project commits. Frame names carry the width, `<width>--<theme>.png`, so a target whose `CASES` carried a per-case `width` and `height` meets a shape change on its next sync rather than an addition.

### Evidence frames

The sweep under `screenshots/` is gitignored and per worktree, so it partitions by branch for free. A `CaptureCase` flagged `evidence: true` breaks from that: its output under `evidence/` carries no hostname or worktree segment and commits, so a capture worth sharing reaches the pull request on its own.

`--require-base-url` skips a flagged case, since a production smoke run should not overwrite the committed baseline with what a live deployment renders. It exits 1 when that skip leaves zero cases run, since a template flagging every case would otherwise check nothing against a live host. The golden template leaves one case unflagged for that reason, so a fresh scaffold's `smoke:prod` always has a route to check.

A first commit to `evidence/` runs the capture twice with no code change between and confirms byte-identical output, since that is what catches a flaky render before it reaches the pull request.

### Where server readiness lives

`scripts/tooling/verify.sh` runs `bun run screenshot` in every scaffolded stack whose `package.json` declares it, being `astro` and `nextjs`, then asserts PNGs landed under `screenshots/`. A capture seed naming one project's selectors therefore fails every other stack's verify unless a selector matching nothing is reported and skipped. `canon tooling verify web` cannot catch that, since `web` carries no scaffold command.

Server readiness stays in `scripts/screenshot.sh` rather than the seed. The wrapper already builds, starts the preview, polls it for ten seconds, and refuses a port already in use, so lifting it into TypeScript rewrites working shell with no defect behind it.

### The README frame workflow

The web stack ships `readme-screenshot.yml`, which commits a refreshed frame back to the pull request branch, and this repository does not run it. `pr-visual-checks.yml` reports the landing page capture and never commits, because that page reads catalog counts at build time and a merge touching no `web/` file moves its bytes. A target's README frame moves only when the branch's own files do, which is the test `governance/rules/ci/700-ci-workflow.md` states for committing. The cost is a shipped template whose commit-back half the first adopting target verifies, not this repository.

### The surface-capture rule reaches every component

`governance/rules/ui/440-surface-capture.md` fires on every component file rather than on routes and pages alone, since a component with no capture can carry a real defect unseen. A component the production build strips out, such as a dev-only scaffold switcher, carries its exemption in the rule body rather than sitting outside a narrower glob. A provider or a layout wrapper that renders no surface of its own fires the rule too, which is the accepted cost. Measured at `64a4297b` on 2026-09-07.

## Gotchas

- `canon capture` and `bun run screenshot` both produce PNGs and overlap nowhere else. `src/capture/render.ts` drives Chromium over static HTML files, while `bun run screenshot` is a web-stack config a target owns that builds, serves, and captures the running application.
- `scripts/screenshot.sh`'s `EXIT` trap guards `kill "$PREVIEW_PID"` the way it guards the `wait` beside it, so a successful capture exits 0 whether or not `astro preview`'s detached process has already exited. The trap also kills whatever `lsof -ti tcp:"$PREVIEW_PORT"` reports bound, when `lsof` is on `PATH`, and warns and falls back to the pid-only kill otherwise.
- Killing by port is safe because the preflight `curl` refuses the run if the port already answers, so anything bound at teardown descends from this run's preview. The one uncovered window sits between that preflight and the trap's installation, during `bun run build`, where a bystander binding the port would be killed on the way out. `src/screenshot-trap.test.ts` reproduces the pid race and asserts the port is unbound once the script exits. Its cases run under vitest's default 5000ms timeout and fail on it when the machine's load average sits near 14, then pass on a rerun, so a Tests stage failure naming only this file on a loaded machine is timing rather than a regression in `scripts/screenshot.sh`.
- The render is byte-deterministic within one machine and across runners. Two local captures of one built preview produced all 36 PNGs byte-identical, and two GitHub runners on unrelated branches produced the same blobs, readable in `main` at `fa07374d` and `71a5e183`. A capture differing from the committed baseline is real page content rather than noise, so the capture job carries no pixel tolerance.
- A frame embedding an `iframe` records the fonts of the machine that shot it. The token preview renders in a different fallback sans on two machines when neither has Geist, and a frame's own fonts still load after its `readyState` reads complete, so the settle requires `fonts.status` to read `loaded` inside each same-origin frame. Read a determinism claim against an artifact from another machine, since a local pair agrees on everything a local cache decides.
