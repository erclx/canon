# Tooling web reference: screenshots

This file continues the web reference, which holds the rest of the stack.

## Screenshot cases

The starter `e2e/home.spec.ts` is seeded once. Sync copies it into a project that has none and leaves it alone after, so grow it freely.

- Edit the `CASES` in the seeded `e2e/capture/cases.ts` or a per-feature `e2e/capture/cases/*.ts`, one entry per output file, since sync overwrites the `e2e/screenshot.ts` harness
- Move cases from `e2e/screenshot.ts` to `e2e/capture/cases.ts` before a sync, and set `EVIDENCE_ROOT = 'evidence'` to keep an existing baseline
- Expect each case crossed with `VIEWPORTS`, written to `screenshots/<hostname>/<section>/<width>--<theme>.png`, so local and deployed runs stay apart
- `VIEWPORTS` holds 390, 768, 1280, and 1536, the last swept alone. A case also fails the run at 320 on a sideways scroll or a clipped control.
- Set `excludeViewports` to skip a width, naming `320` to defer the reflow check

## Device classes

The harness reads the `[device-classes]` table in `canon/config/device-classes.toml`, and a project with no file captures every width as before. It needs Bun to parse the file, which `bun e2e/screenshot.ts` already runs it under.

- A case captures at its `deviceScope`, naming a table under `[device-classes.scopes]`, or at the `default` when it names none, and a scope the config lacks exits 1
- A width outside the case's classes takes no frame, with phone under 600, tablet from 600 to 839, and desktop from 840, 1536 included
- A case leaving phone out also skips the 320 reflow check, and a config the reader refuses, such as a name outside phone, tablet, and desktop, exits 1
- Committed frames at a width the config drops stay under `EVIDENCE_ROOT` until the project deletes them
- A `Device classes:` line left in `canon/DESIGN.md` is read by nothing. Move its classes into `default` with a `why`.

## Screenshot sections

- Set `evidence: true` to also write `<EVIDENCE_ROOT>/<section>/<width>--<theme>.png` at 390, 768, and 1280. `EVIDENCE_ROOT` defaults to `e2e/evidence`.
- Name `sections` on a case, one `{ name, selector }` per addressable part of the route, each written as its own frame beside the whole-page one
- Expect a section frame at `screenshots/<hostname>/<section>/<name>/<width>--<theme>.png`, plus the same path under `EVIDENCE_ROOT` where flagged
- Expect a selector matching nothing to be reported and skipped, since a seeded list may name sections the page lacks, and test that they resolve in the project owning the selectors

## Screenshot masks

- List under `mask` the selectors painted over in every frame, for a value that moves with no code change, so a double capture compares the rest
- Expect a mask skipped and reported where an opaque element, such as a dialog, covers its element's center, since the bar is drawn above every layer
- A dimmed backdrop does not count as cover, and the reading taken before the whole-page frame holds for the section frames

## Screenshot settling

- Expect `reducedMotion: 'reduce'`, and each named section scrolled into view so an `IntersectionObserver` fires and `loading="lazy"` frames load before the page returns to the top
- Expect fonts, images, and same-origin frames waited out on a bounded condition, since a second `networkidle` does not re-arm for a load a scroll started
- Expect a section frame to drop floating chrome (`position: sticky` or `fixed`), while the whole-page frame is shot first and keeps its chrome

## Screenshot run flags

- `SCREENSHOT_FILTER` keeps cases whose `<section>/<width>--<theme>` label contains a comma-separated term, and exits 1 listing the labels on no match
- `--check-console-clean` exits 1 with the list if any `console` error fired, turning the capture into a smoke check
- `--require-base-url` exits 1 before launching a browser when `SCREENSHOT_BASE_URL` is unset, so a deployment script cannot capture `localhost`
- `--print-device-classes` prints the default classes as a comma list, such as `desktop`, and `--print-device-classes=<scope>` prints a scope's, both before a browser launches
- Either print exits 1 on a config it refuses or a scope it lacks
- With a base URL, every flagged case is skipped so a production smoke run writes nothing to the committed path, and zero cases run exits 1

## Screenshot evidence

- Expect the sweep under `screenshots/` to be ignored and only a flagged case's `EVIDENCE_ROOT` output tracked, so a target's first capture is the baseline it commits
- Size a case's `sections` list against the frames each later change regenerates, since a case naming sections commits a folder per section
- Run the capture after a surface changes, component files included, per the `ui-craft` skill's capture reference, unless the production build strips the component out

## Screenshot scripts and workflows

- `scripts/screenshot.sh` sources `scripts/lib/preview-server.sh`, builds, serves on `PREVIEW_PORT`, waits for the port, and traps the whole process group on exit
- `scripts/readme-screenshot.sh` captures one case under `SCREENSHOT_FILTER` into `<EVIDENCE_ROOT>/readme/`, and exits 1 until a project fills `README_FILTER`
- `.github/workflows/readme-screenshot.yml` pushes with `RELEASE_PLEASE_TOKEN` to start the required checks, and exits 1 while its paths hold `REPLACE_WITH_PROJECT_PATHS`
- `.github/workflows/verify.yml` runs `static-checks`, `unit-tests`, `build-verify`, and `e2e-tests`. `unit-tests` installs Chromium and runs `test:browser` only when the project defines that script.
- Read `governance/rules/tooling/ci-workflow.md` for when a workflow's commit-back is right and when a report is

## Screenshot on a taken port

`screenshot` assigns `PREVIEW_PORT` from `scripts/worktree-port.sh`, so a value set by hand before the run is overwritten.

- Set `WORKTREE_PORT_OFFSET` to move a run off a taken port, since it moves the preview and the screenshot port together
- Expect a hand-set `PREVIEW_PORT` on a direct `bash scripts/screenshot.sh` call to wait on a port nothing serves, since the preview binds its own derived port
