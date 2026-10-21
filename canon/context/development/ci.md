---
title: CI
description: The GitHub Actions workflows that gate pull requests into main, scan them for leaked labels, cut and publish releases, and refresh the capture frames
---

# CI

## Overview

Owns the workflows in `.github/workflows/` that verify a pull request, scan its text, release after a merge, and refresh the landing-page frames. CI runs the gate through one entry point, `bun run check:ci`, and `check:install` beside it. The stages themselves sit in `src/gate/` and are described in `canon/context/development/local-loop.md`.

## Layout

### `.github/workflows/`

`verify.yml` calls the gate once rather than naming each stage, so a stage added to `src/gate/stages.ts` is enforced with no workflow edit. Each workflow states its reasons in comments beside the line. The web previews belong to `canon/context/development/web.md`. Workflows needing no write set a read-only token, and Dependabot watches the actions.

- `verify.yml` runs on pull requests into `main`, pushes to `main`, `merge_group`, dispatch, and a weekly cron that runs `dependency-advisories` alone
- The Install Plugin CLI step pins `@anthropic-ai/claude-code` exactly. Test a raised pin with `bun install -g` on a fresh runner, since `2.1.237` left a wrapper that cannot run.
- `release-please.yml` keeps a release pull request open, and merging it tags, rewrites `CHANGELOG.md`, and runs `publish` to npm. A lost publish is repaired by dispatching the workflow with `tag`.
- `publish-check` reads only the newest release, so a lost release followed by a good one goes unreported, as 5.0.0 did and stays GitHub-only
- `refresh-capture-frames.yml` runs on `main` only and queues `gh pr merge --auto --squash`. Its push step rebuilds the branch on a fresh `main` and carries only the files it wrote or dropped.

### `stack-verify.yml`

Runs weekly and on dispatch, one matrix job per scaffoldable stack through `canon tooling verify`. Only its `report` job holds `issues: write`, keeping one open `stack-verify: <stack>` issue per red stack. A layer or an add-on never joins the matrix, since the verb refuses it.

### `src/labels/`

`phase-label-gate.yml` runs `canon labels scan` on the event payload, since no gate stage sees a pull request body or a posted review. It needs `edited` on its trigger, so it sits outside `verify.yml`. It never passes `--closes`, which needs a task board. Body density stays out of the exit, so an edit to an older pull request fails nothing new.

- It also triggers on `pull_request_review` and reads `review.body`, and its `if:` checks the base ref because that event carries no `branches` filter
- A release-please pull request is told apart by both the `release-please--branches--main` head prefix and the `chore(main): release ` title prefix
- The scan drops fenced blocks and blanks inline spans, but leaves link destinations, since a release body keeps its semver in a compare link
- `VERSION_SPAN` in `src/labels/phase.ts` reads a span holding only a version as a hit, so an author quoting a label alone in a span is still caught
- The seeded copy under `tooling/base/configs/.github/workflows/` runs `bunx -y @erclx/canon labels scan` with no install step, since a `python` target has no lockfile

### Other folders

The release configuration, the manifests, and the install check sit beside the workflows.

- The root owns `release-please-config.json`, whose `bootstrap-sha` stops a first run versioning every untagged commit and whose `include-component-in-tag: false` keeps tags `v<semver>`
- `.claude-plugin/` and `claude/.claude-plugin/` hold the manifests release-please versions, and `.oxfmtrc.jsonc` ignores the files the tool writes
- `scripts/ci/` owns the programs the long steps call, such as `publish-check.sh` and `refresh-frames-pr.sh`, and a step past five lines moves there
- `scripts/core/` owns `install-check.sh`, run in CI after `check:ci` and kept out of the local gate because a cold pack-and-install is unmeasured
- `package.json` pins `typescript` to the v5 line `@astrojs/check` expects, so `bun add -D typescript` selecting v7 is a compiler upgrade

## Gotchas

- `no checks reported on the '<branch>' branch` usually means a merge conflict, since such a branch has no merge ref to run on. Read `gh pr view --json mergeable,mergeStateStatus` and rebase.
- A green `🛡️ Static Checks` tested `refs/pull/<n>/merge` as of the last push. No merge queue exists, so a sibling merge leaves it stale until the poll reads `STALE`.
- The job name `🛡️ Static Checks` is what the ruleset requires, so renaming it strands branch protection
- The runner installs no browser, so each `*.e2e.test.ts` skips itself and a green run does not show it ran. Verify those locally.
- The `merge_group` trigger is inert, since a `merge_queue` rule returns `422` on a user-owned repository until a move to an organization
