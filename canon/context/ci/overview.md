---
title: Overview
description: What the CI domain owns, the single gate entry point, the triggers and the ruleset gap, and running CI locally
---

# Overview

## Overview

Owns the GitHub Actions verification that gates pull requests into `main`, and the release automation after a merge. CI runs every gate stage through `bun run check:ci` and `check:install` beside it. Four workflows live in `.github/workflows/`, being `verify.yml`, `phase-label-gate.yml`, `release-please.yml`, and `refresh-capture-frames.yml`.

CI differs from the local gate in two ways.

- Scope: the local run gates shell, types, and tests on the changed-file set, while CI passes `--all` and runs them unconditionally
- The plugin manifest stage skips on a machine without the CLI and fails on a runner that should have installed it

`canon/context/ci/checks.md` carries the stage table and the checks outside the gate, and `canon/context/ci/releases.md` carries the release and capture-refresh workflows.

## Decisions

### The workflow surface

The workflow calls one entry point instead of naming each stage as a step. Named steps label failures more clearly in the GitHub UI, but they drift out of sync with the script and leave stages enforced only by a pre-push hook that `git push --no-verify` skips. The failing stage still appears in the step output, one click deeper.

- One job runs everything, the carve-out `ci-workflow` states
- `auditSet` in `src/gate/measures.ts` scopes `canon audits run` to the tracked and per-machine corpora, and `src/deps/audit.ts` bounds the advisory lookup at 120 seconds
- A local `canon gate run --all` takes about 41 seconds, so each extra job would add three or four minutes of checkout, install, and apt setup for no earlier signal
- The skill conditions the carve-out on a gate under roughly two minutes, so the workflow splits once its own run log crosses that
- The job name stays `🛡️ Static Checks` though it runs the tests, since a rename breaks branch protection

### Formatting and scope

The gate asserts formatting in every mode and writes none of it, and CI names the `check:ci` script rather than setting anything inline. A local write mode chosen by a flag formatted in place and then could not fail on formatting, so a push rewrote files and left a follow-up style commit. `bun run format` is the one writer.

Scope selection goes through an `--all` argument, since it describes what to run rather than which mode. An unknown argument exits 1, and `--help` prints the flags, the exit codes, and what an unmeasured stage means.

### Triggers

Three workflows run the gate or its release side, each on its own events.

- `verify.yml` runs on pull requests targeting `main`, pushes to `main`, `merge_group`, `workflow_dispatch`, and a weekly `schedule` that runs the `dependency-advisories` job alone
- `phase-label-gate.yml` runs on a pull request targeting `main` opened, edited, reopened, or synchronized, and on `workflow_dispatch`
- `release-please.yml` runs on pushes to `main`, and on `workflow_dispatch` with an optional `tag` that publishes that tag alone

CI is what makes a scoped local gate safe. Scoping baselines on `origin/main`, so a branch gates against what it will merge into rather than its own tip.

### What a green run tests

A `main` baseline answers a branch tested against a stale `main`, but not two branches each green against the same `main` whose combination is red. Ruleset `12882487` requires `🛡️ Static Checks` with `strict_required_status_checks_policy: false` and no `merge_queue` rule.

- A pull request's run checks out `refs/pull/<n>/merge`, the merge with `main` as of its last push (run 37203889787, Checkout step)
- Nothing re-runs it when `main` moves, so once a sibling merges the green describes a merge nobody will make

The orchestrator poll covers that gap by hand, as `canon/context/orchestration.md` describes.

- `STALE` names an open pull request whose files `main` changed since it branched, so its worker rebases and re-runs the gate while the draft mark stays on
- `OVERLAP` names two open pull requests that conflict with each other, so the merge order is settled before either lands

### The merge queue gap

A merge queue would close the gap, and this repository cannot have one. `PUT /repos/erclx/canon/rulesets/12882487` with a `merge_queue` entry returns `422`, since merge queue is restricted to organization-owned repositories and `erclx/canon` has a `User` owner on the free personal plan. Measured on 2026-09-06.

The `merge_group` trigger stays as a prerequisite, since a workflow with no job listening for the event never completes a queue entry. It is inert until a `merge_queue` rule exists, which first needs a move off personal ownership.

### Job guards and checkout

The `static-checks` job carries `if: github.event_name != 'schedule'` and `dependency-advisories` carries the opposite. Both share one `on:` block, and the guard keeps a weekly cron from re-running the whole gate over an unchanged tree and a pull request from running an advisory lookup nothing asked for.

- `dependency-advisories` runs `bun src/cli.ts deps audit` alone, with no `fetch-depth: 0` and no shell-tools install, since nothing it reads needs history or shellcheck
- The `Checkout` step passes `fetch-depth: 0` because `actions/checkout@v4` fetches one shallow ref on a `pull_request` event, so `origin/main` never resolves and merge-base stages refuse

### Why the push trigger and the types stage exist

The push trigger gives the README's CI badge a default-branch run to report. A badge filtered to `main` reads `no status` while the workflow runs on pull requests alone. A squash merge also runs the full gate against the merged result, which no pull request run observes.

The types stage runs in CI rather than only in the pre-push hook because a missing or wrong import is the failure the bash migration produces most, and the test suite catches one only where a test covers the caller. It sits before the tests in the stage table because it reports in about a second.

### Running CI locally

`bun run check` scopes shell, types, and tests to the changed-file set, so a local pass is weaker than a CI pass. Run `bun run check:ci` or `bun run check --all` to reproduce CI. If CI fails on format, run `bun run format` locally and commit the diff.

## Gotchas

### No checks reported

Read `no checks reported on the '<branch>' branch` as a possible merge conflict rather than CI lag. A `pull_request` workflow runs against a merge ref GitHub computes from head and base, and a conflicting branch has no such ref, so the run is never queued.

- Check `gh pr view --json mergeable,mergeStateStatus`, where `CONFLICTING` and `DIRTY` mean the branch needs a rebase, and force-pushing queues the run within a minute
- Autoship's CI watch runs in the background and exits on `conflicted: true`, with a 60-minute timeout otherwise, so a branch with no run reports CI unsettled rather than shipped

### Badge verification

A shields.io badge URL returns HTTP 200 whether or not the query resolves, so a status-code check passes a badge that renders `no status`. That includes a badge filtered to a branch the workflow never triggers on. Curl the URL and grep the rendered `<title>` for the value it reports.

### Exit-code flags

An exit-code flag counts only states some documented action can drive to zero, since a permanent condition makes the gate unpassable rather than informative. For each state a gate counts, name the action that clears it, and where there is none, exclude it and report it separately.

`canon sync --check --exit-code` excludes `orphaned` from the count, since a single local rule in `.claude/rules/` would otherwise return 1 on every run with no remedy.

### Missing browser on the runner

The runner installs no browser binary, so a test needing one skips rather than fails, and a green pipeline is not evidence it ran. Each `*.e2e.test.ts` under `src/` guards itself with a launch probe and reports the skip in its own header, among them the demo and driver drives, the inventory walk, the slides export, and the canvas shell walk.

Adding the install would slow every run, so the gap stays open and a change under any of them is verified locally. The plugin CLI install in `canon/context/ci/checks.md` is the precedent for closing it as the count grows.
