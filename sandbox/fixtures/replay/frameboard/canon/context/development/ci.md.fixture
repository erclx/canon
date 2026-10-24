---
title: CI
description: GitHub Actions workflow triggers and checks
---

# CI

## Overview

Owns the GitHub Actions workflows that gate a merge. Pull requests targeting `main` run the checks and all must pass, a push to `main` runs the release workflow, and `workflow_dispatch` runs any workflow. The checks call package scripts, covered in `canon/context/development/local.md`.

## Layout

### `.github/workflows/`

| Check                       | Workflow                | Command                                                                   | What it asserts                                                                                                      |
| --------------------------- | ----------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Static Checks               | `verify.yml`            | `bun run typecheck`, `bun run lint`, `bun run check:format`               | tsc, oxlint with zero warnings, and oxfmt are clean                                                                  |
| Unit Tests                  | `verify.yml`            | `bun run test:coverage`                                                   | the Vitest `node` project passes, with coverage                                                                      |
| Build                       | `verify.yml`            | `bun run build`                                                           | Vite builds the client and rolldown bundles `dist/cli.js`                                                            |
| E2E Tests                   | `verify.yml`            | `bun run test:e2e --project=chromium` with `DIST_PREBUILT`                | Playwright passes against the built CLI the Build job uploaded                                                       |
| Browser Component Tests     | `frameboard-checks.yml` | `bunx vitest run --project browser`                                       | the Vitest `browser` project passes in headless Chromium                                                             |
| CLI on Node and Bun         | `frameboard-checks.yml` | `node` and `bun` on `dist/cli.js --version`                               | the bundle runs on both runtimes from outside the checkout                                                           |
| Edit Writer on Node and Bun | `frameboard-checks.yml` | `property.test.ts` under `bunx vitest` and `bun --bun vitest`, then `cmp` | the edit property run passes and writes the same output digest on both runtimes                                      |
| macOS Unit and CLI Smoke    | `frameboard-checks.yml` | `bunx vitest run --project node`, then `bash scripts/smoke-cli.sh dist`   | the `node` project passes on Apple Silicon, and `serve`, the structure verbs, and `check` run from an outside bundle |

Ownership and the workflows the table leaves out sit below.

- `verify.yml` owns the golden verify jobs, which a `canon tooling sync` rewrites, and `frameboard-checks.yml` owns the project's own jobs, which a sync never touches
- The macOS job runs no browser or E2E layer, so macOS-only rendering drift reaches CI only through a local run
- `phase-label-gate.yml` runs `canon labels scan`, failing a pull request carrying a phase label, board reference, or session link, and `pr-local-preview.yml` owns the evidence preview
- `canon/config/pr-labels.toml` maps paths to the labels `git-pr` puts on a pull request, and `canon labels audit` names any surface no row reaches

Releases run through three further bullets.

- `release-please.yml` owns the release pull request, the npm publish, and the npm check in `scripts/check-npm-publish.sh`, reading `release-please-config.json` and `.release-please-manifest.json`
- The release job runs `scripts/check-npm-credential.sh` before it cuts a tag, so an unset or revoked `NPM_TOKEN` fails the run early
- The publish job builds the tag and refuses one whose `dist/cli.js --version` differs, so a mismatched tarball never reaches npm, and a `tag` input publishes that tag alone

## Gotchas

- The browser project runs in `frameboard-checks.yml` and not in `unit-tests`, which installs no browser, and a hand edit to `verify.yml` is reverted by the next sync
- No `canon tooling sync` writes `release-please.yml`, so a later fix to canon's copy reaches this one only by hand
- `initial-version` is `0.0.1` against a `0.0.0` manifest, since release-please reads `0.0.0` as no release and otherwise cuts `1.0.0`
- `bump-minor-pre-major` is on, so a breaking change on 0.x lands as a minor bump, and `bootstrap-sha` is the root commit so the first release pull request opens
- `.prettierignore` carries `/CHANGELOG.md`, because oxfmt rejects the changelog release-please writes and a sync overwrites `.oxfmtrc.json`
