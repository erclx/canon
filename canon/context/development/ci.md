---
title: CI
description: The GitHub Actions workflows that gate pull requests into main, scan them for leaked labels, cut and publish releases, and refresh the home baseline
---

# CI

## Overview

Owns the workflows in `.github/workflows/` that verify a pull request, scan its text, release after a merge, and refresh the home baseline. CI runs the gate through one entry point, `bun run check:ci`, and `check:install` beside it. The stages themselves sit in `src/gate/` and are described in `canon/context/development/local-loop.md`.

## Layout

### `.github/workflows/`

`verify.yml` calls the gate once rather than naming each stage, so a stage added to `src/gate/stages.ts` is enforced with no workflow edit. Each workflow states its reasons in comments beside the line. The web previews belong to `canon/context/development/web.md`. Workflows needing no write set a read-only token, and Dependabot watches the actions.

- `verify.yml` runs on pull requests into `main`, pushes to `main`, `merge_group`, dispatch, and a weekly cron that runs `dependency-advisories` alone
- The Install Plugin CLI step pins `@anthropic-ai/claude-code` exactly. Test a raised pin with `bun install -g` on a fresh runner, since `2.1.237` left a wrapper that cannot run.
- `release-please.yml` keeps a release pull request open, and merging it tags, rewrites `CHANGELOG.md`, and runs `publish` to npm. A lost publish is repaired by dispatching the workflow with `tag`.
- `publish-check` reads only the newest release, so a lost release followed by a good one goes unreported, as 5.0.0 did and stays GitHub-only
- `refresh-capture-frames.yml` runs on `main` only and queues `gh pr merge --auto --squash`. Its push step rebuilds the branch on a fresh `main` and carries only the files it wrote or dropped.

### `verify.yml`

Runs `🛡️ Static Checks` on Linux and `🍎 macOS Unit Tests` beside it, neither on the weekly cron. The macOS job runs `bun run test` alone, since lint, types, format, shell, build, and browser results do not differ by platform.

- The macOS job blocks a merge, since the ruleset requires it beside `🛡️ Static Checks` as of 2026-11-06, and `canon pr lift` and `canon pr merge` gate by the required checks
- A new push to a pull request cancels its older run. Every other event keys its group on the commit, so `main`, `merge_group`, and the cron never cancel.
- The Pin Stock Bash step links `/bin/bash` 3.2 first on `PATH`, and the next step fails on any other major version, so every test spawning `bash` runs on what a Mac ships
- A test assuming `shellcheck`, `shfmt`, `claude`, or `/proc` skips on macOS without it, and the job never gains an install step
- A macOS temp root under `/var` is a symlink to `/private/var`, so a test comparing it with a path git or a child reports wraps `mkdtempSync` in `realpathSync`

### `🎬 E2E Suites`

One check over a matrix that runs each group of `*.e2e.test.ts` suites on its own runner, skipped whole by a Markdown-only pull request. `scripts/ci/e2e-scope.ts` limits a pull request to the suites its imports reach, and a trigger file, a failed read, or a push runs all.

- FFmpeg comes from apt with `Acquire::Retries=3` and a 5-minute step bound, since the runner image lists none, once `prefer-archive-mirror.sh` has run
- `bunx playwright install chromium` lands the engine's browsers, and `canon browser install-browser chromium` the agent CLI's own revision, which the swipe suite launches
- The browser cache keys on `bun.lock` and `src/browser/agent-cli.ts` under its own prefix, since a hit on the capture job's cache would skip the agent CLI install
- `scripts/ci/check-browsers.sh` and `scripts/ci/check-e2e-tools.sh` run first, so a missing revision or `libwebp_anim` encoder, or a Chromium that cannot launch, reddens the job
- A sysctl clears `kernel.apparmor_restrict_unprivileged_userns`, since Ubuntu 24.04 kills every product launch of Chromium, which all run with the sandbox on

### `scripts/ci/e2e-scope.ts`

Picks the suites a pull request runs from what it changed, and falls back to all of them on any read that fails.

- Each suite that spawns the CLI imports the command it drives, so vitest selects it on a change to that command's graph
- `src/gate/corpus-readers.test.ts` fails on a spawning suite that imports no `@/commands/` module
- A change to `src/cli.ts` or a module it loads outside a command, read by `src/gate/cli-bootstrap.ts`, selects both, since every command runs through them
- A change to `package.json` moving only `version` selects nothing on its own, so a release runs no suite, and a read of either side that fails runs all

### `scripts/ci/e2e-groups.ts`

Holds the groups, balanced by each suite's mean time on a runner. Vitest's `--shard` balances by file count, which puts a half-second suite level with a four-minute one. A leg the scope leaves empty passes with no setup.

- `src/gate/e2e-groups.test.ts` fails on a suite in no group or in two, and on a timed suite sharing its group. A new suite takes a line in the script.
- `src/gate/e2e-workflow.test.ts` fails on a group the matrix drops or a step that would skip on a missing output, and runs the summary step over each result pair
- The summary job fails on a failed or cancelled leg and on a failed `🔍 Changes` job, and passes on a skipped matrix only where the scope reached no suite
- The ruleset requires the check once the operator adds it by hand, after 10 consecutive green runs on `main`

### `scripts/ci/docs-only.sh`

A pull request changing only `.md` files skips `🍎 macOS Unit Tests`, which is the slowest check. The `🔍 Changes` job runs `scripts/ci/docs-only.sh` against the pull request's base and outputs `code=false` only when every changed file ends in `.md`.

- The skip lives in the job's `if:` rather than a path filter, since a job skipped by its condition reports success and a skipped workflow never reports, which would strand a required check
- `!cancelled()` keeps the job running when `🔍 Changes` is skipped on a push or fails, so only a detector that succeeded can skip the tests
- The script splits renames and treats an empty or failed diff as code, so a `.ts` file renamed to `.md` still runs the tests
- Every push to `main` runs the job, so a Markdown file a macOS test reads is caught at most one merge late, and `🛡️ Static Checks` runs the full suite on every pull request

### `stack-verify.yml`

Runs weekly and on dispatch, one matrix job per scaffoldable stack through `canon tooling verify`. Only its `report` job holds `issues: write`, keeping one open `stack-verify: <stack>` issue per red stack. A stack with no scaffold never joins, since the verb refuses it.

- The go job installs Go through `actions/setup-go`, because the runner image's Go can lag the 1.25 floor that the scaffold's `go mod edit -ignore` needs

### `src/labels/`

`phase-label-gate.yml` runs `canon labels scan` on the event payload, since no gate stage sees a pull request body or a posted review. It needs `edited` on its trigger, so it sits outside `verify.yml`. It never passes `--closes`, needing a task board, or `--plan`, reading a gitignored plan. Body density fails the exit, and post density does not.

- It also triggers on `pull_request_review` and reads `review.body`, and its `if:` checks the base ref because that event carries no `branches` filter
- A release-please pull request is told apart by both the `release-please--branches--main` head prefix and the `chore(main): release ` title prefix
- The scan drops fenced blocks and blanks inline spans, but leaves link destinations, since a release body keeps its semver in a compare link
- `VERSION_SPAN` in `src/labels/phase.ts` reads a span holding only a version as a hit, so an author quoting a label alone in a span is still caught
- The seeded copy under `tooling/base/configs/.github/workflows/` runs `bunx -y @erclx/canon labels scan` with no install step, since a `python` target has no lockfile

### `scripts/ci/install-playwright-deps.sh`

Canon's own workflows installing the firefox and webkit system packages call this script, since a stalled `azure.archive.ubuntu.com` connection hangs rather than fails and a step bound alone only turns the hang red. No seeded web workflow calls it, and neither do canon's chromium-only capture and refresh jobs, because the hosted image ships Chrome.

- The script kills an attempt at 150 seconds and retries up to three times, running `dpkg --configure -a` before each retry
- It runs `prefer-archive-mirror.sh` before the first attempt and with `--drop-first` before each retry, since a retry on the same degraded mirror fails again
- A signal from the runner user never reaches the root `apt-get` that `sudo` spawns, so the script kills any left behind with `sudo pkill` before that
- `src/gate/workflow-timeouts.test.ts` fails a direct `install-deps` or `--with-deps` call and an unbounded script step, in `.github/workflows/` and every `tooling/*/configs/.github/workflows/`
- The same file fails a shipped workflow that calls this script, since the seeded web workflows lean on the hosted image

### `scripts/ci/prefer-archive-mirror.sh`

An AWS-hosted runner lists `ec2.archive.ubuntu.com` first in `/etc/apt/apt-mirrors.txt`, and that mirror can degrade to a trickle that times an install out. Azure runners list `azure.archive.ubuntu.com` first and are left alone.

- The script deletes the ec2 line, or with `--drop-first` every line above `archive.ubuntu.com`, and always exits 0
- A list with no such line, only that line, or no file is left unchanged, so the list is never emptied
- `src/gate/workflow-timeouts.test.ts` fails a step in `.github/workflows/` running `apt-get install` without it, and shipped workflows are out of reach

### `release-please-config.json`

The root owns this config and the manifests it versions.

- Its `bootstrap-sha` stops a first run versioning every untagged commit, and `include-component-in-tag: false` keeps tags `v<semver>`
- Its `exclude-paths` skips a commit whose every file is unshipped. `src/gate/release-paths.test.ts` fails on a tracked folder neither shipped nor excluded, reading `assets` one level down.
- `exclude-paths` matches folder prefixes only, so an entry naming a file never matches. An unshipped root file moves into an excluded folder instead.
- A landing page pull request that also edits `README.md`, `package.json`, or `scripts/` is let in by a path that ships, so `chore(web)` stays out of the notes and `feat(web)` does not
- `.claude-plugin/` and `claude/.claude-plugin/` hold the manifests release-please versions, and `.oxfmtrc.jsonc` ignores the files the tool writes

### Other folders

The CI programs, the install check, and a version pin sit beside the workflows.

- `scripts/ci/` owns the programs the long steps call, such as `publish-check.sh`, `refresh-frames-pr.sh`, and `install-playwright-deps.sh`, and a step past five lines moves there
- `scripts/core/` owns `install-check.ts`, run in CI after `check:ci` and kept out of the local gate because a cold pack-and-install is unmeasured
- `src/gate/workflow-timeouts.test.ts` fails a job with no `timeout-minutes` in canon's or any stack's workflows and skips one that sets `uses:`. A timeout never reaches a run that starts no job.
- `package.json` pins `typescript` to the v5 line `@astrojs/check` expects, so `bun add -D typescript` selecting v7 is a compiler upgrade

## Gotchas

- `no checks reported on the '<branch>' branch` usually means a merge conflict, since such a branch has no merge ref to run on. Read `gh pr view --json mergeable,mergeStateStatus` and rebase.
- A green `🛡️ Static Checks` tested `refs/pull/<n>/merge` as of the last push. With no merge queue, a sibling merge leaves it stale until a worker's standing wait or the poll reads it.
- The ruleset requires `🛡️ Static Checks` and `🍎 macOS Unit Tests` by name, so renaming either strands branch protection and leaves lift and merge waiting on a check no run reports
- `vitest.config.ts` keeps every `*.e2e.test.ts` out of `🛡️ Static Checks`. Only the `🎬 E2E Suites` groups run them, minus the probe tests under `src/driver/probes/` and `src/take/target.test.ts`.
- The `merge_group` trigger is inert, since a `merge_queue` rule returns `422` on a user-owned repository until a move to an organization
