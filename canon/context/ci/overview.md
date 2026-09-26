---
title: Overview
description: What the CI domain owns, the single gate entry point, the triggers and the ruleset gap, and running CI locally
---

# Overview

## Overview

Owns the GitHub Actions verification that gates pull requests into `main`, and the release automation that runs after one merges. CI runs every gate stage through one entry point, `bun run check:ci`, plus one further step outside the gate, `bun run check:install`. Four workflows are described here, `verify.yml`, `phase-label-gate.yml`, `release-please.yml`, and `refresh-capture-frames.yml`.

Three things differ from the local gate:

- Formatting: the local run writes and CI asserts
- Scope: the local run gates shell, types, and tests on the changed-file set, while CI passes `--all` and runs them unconditionally
- The plugin manifest stage, skipping on a machine without the CLI and failing on a runner that should have installed it

`canon/context/ci/checks.md` carries the stage table and the checks outside the gate, and `canon/context/ci/releases.md` carries the release and capture-refresh workflows that run after a merge.

## Layout

- `.github/workflows/` owns every workflow and their job definitions

## Decisions

### The workflow surface

The workflow calls one entry point instead of naming each stage as its own step. Named steps give clearer failure labels in the GitHub UI, but they drift out of sync with the script, leaving stages enforced only by a pre-push hook that `git push --no-verify` skips. A single entry point cannot drift, and the failing stage still appears in the step output, one click deeper.

One job runs all of it, which is the carve-out `ci-workflow` states rather than an exemption this repository took. `auditSet` in `src/gate/measures.ts` scopes `canon audits run` to the tracked and per-machine corpora, and `src/deps/audit.ts` bounds the dependency-advisory lookup at a 120-second timeout for the caller that still wants it.

A local `canon gate run --all --no-write` runs in about 41 seconds, so each extra job still repays checkout, `bun install --frozen-lockfile`, and an apt install before reaching a stage, and a split buys three or four minutes of setup for no earlier signal. The skill conditions the carve-out on a gate under roughly two minutes, so this workflow splits once its own run log crosses that.

The job name stays `🛡️ Static Checks` even though the job runs the test suite. Required status checks resolve against the job name, so renaming it would break branch protection until the rule updates to match.

Mode selection goes through `--no-write`, and CI names the `check:ci` script rather than setting anything inline. The two questions a caller answers, what to run and whether to write, both resolve through flags, since splitting one across a flag and the other across an environment variable would leave the surface half discoverable. Each mode runs exactly one format stage: the local run formats in place, and CI asserts.

Scope selection goes through an `--all` argument, since it describes what to run rather than which mode to run in. An unknown argument exits 1, and `--help` prints the flags, the exit codes, and what an unmeasured stage means, so the surface stays discoverable without reading the table.

### Triggers

- `verify.yml` on pull requests targeting `main`, on pushes to `main`, on `merge_group` for a queued entry, on a weekly `schedule` that runs the `dependency-advisories` job alone, and on `workflow_dispatch`
- `phase-label-gate.yml` on a pull request targeting `main` opened, edited, reopened, or synchronized, and on `workflow_dispatch`
- `release-please.yml` on pushes to `main`, and on `workflow_dispatch` with an optional `tag` that publishes that tag alone

CI is what makes a scoped local gate safe. `verify.yml` triggers on `pull_request`, pushes to `main`, `merge_group`, a weekly `schedule`, and `workflow_dispatch`. Scoping baselines on `origin/main`, so a branch gates against what it will merge into rather than against its own tip.

That baseline answers a branch tested against a stale `main`, but not two branches each green against the same `main` whose combination is red. The ruleset governing merges (id `12882487`) requires `🛡️ Static Checks` and carries `strict_required_status_checks_policy: false` with no `merge_queue` rule, so a pull request's green run tests against its own branch tip rather than the state it will actually merge into.

The `merge_group` trigger above is a prerequisite for closing that gap through a merge queue rather than a fix on its own: a workflow with no job listening for the event never completes a queue entry, so the trigger has to exist before a `merge_queue` rule can be added, and it stays inert without one.

A `merge_queue` ruleset rule is the GitHub REST type this would append, and the API refuses it here: `PUT /repos/erclx/canon/rulesets/12882487` with a `merge_queue` entry returns `422` with an empty rule-specific message, and merge queue is restricted to organization-owned repositories, confirmed against `erclx/canon`'s owner type (`User`) and the free personal plan. This repository cannot close the gap above without first moving off personal ownership. Measured against ruleset `12882487` on 2026-09-06.

The `static-checks` job carries `if: github.event_name != 'schedule'` and a second job, `dependency-advisories`, carries the opposite: `if: github.event_name == 'schedule'`. Both jobs sit in the one workflow file because they share the same `on:` block, and the `if:` guard is what keeps a weekly cron firing from re-running the whole gate over an unchanged tree, or a pull request from running an advisory lookup nothing in the diff asked for. `dependency-advisories` runs `bun src/cli.ts deps audit` alone, no `fetch-depth: 0` and no shell-tools install, since nothing it reads needs history or shellcheck.

The `Checkout` step passes `fetch-depth: 0` for the same reason. `actions/checkout@v4` defaults to a shallow, single-ref fetch on a `pull_request` event, so `origin/main` never resolves and any stage reading a merge base refuses without the flag.

The push trigger exists to give the README's CI badge a default-branch run to report. A badge filtered to `main` reads `no status` while the workflow runs on pull requests alone, and an unfiltered one reports whichever branch happened to run last. The second cost is the useful one: a squash merge runs the full gate against the merged result, which no pull request run observes.

The types stage runs in CI rather than only in the pre-push hook because a missing or wrong import is the failure mode the bash migration produces most, and no other stage catches it. The test suite only catches one where a test happens to cover the caller. In the stage table it sits before the tests for the same reason, since it reports in about a second and the suite does not.

## Gotchas

Read `no checks reported on the '<branch>' branch` as a possible merge conflict rather than as CI lag. A `pull_request` workflow runs against a merge ref GitHub computes from the head and the base, and a conflicting branch has no such ref, so the run is never queued and nothing reports why. Check `gh pr view --json mergeable,mergeStateStatus`: `CONFLICTING` and `DIRTY` mean the branch needs a rebase, and force-pushing queues the run within a minute. Autoship's CI watch has no timeout distinguishing the two, so a conflicting branch polls until the operator intervenes.

A shields.io badge URL returns HTTP 200 whether or not the query resolves, so verifying a badge by status code alone passes one that renders `no status`. A badge filtered to a branch the workflow never triggers on renders `no status` behind that 200. Curl the URL and grep the rendered `<title>` for the value it reports.

An exit-code flag counts only states some documented action can drive to zero, since a permanent condition makes the gate unpassable rather than informative. `canon sync --check --exit-code` excludes `orphaned` from the count, since a single local rule in `.claude/rules/` would otherwise return 1 on every run with no remedy. For each state a gate counts, name the action that clears it, and where there is none, exclude it and report it separately.

The runner installs no browser binary, so a test needing one skips rather than fails, and a green pipeline is not evidence that test ran. `src/demo/drive.e2e.test.ts` guards itself with a launch probe and reports the skip in its own header. Adding the install would slow every run for one suite, so the gap stays open and a change to the demo driver is verified locally. The plugin CLI install in `canon/context/ci/checks.md` is the precedent for closing it if the count of such tests grows.

## Running CI locally

`bun run check` formats in place where CI asserts formatting. It also scopes shell, types, and tests to the changed-file set, so a local pass is weaker than a CI pass and the two do not mean the same thing. Run `bun run check:ci` to reproduce what CI does, or `bun run check --all` to keep the local write-mode format stage while running every check. If CI fails on format, run `bun run check` locally and commit the diff.
