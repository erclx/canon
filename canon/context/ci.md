---
title: CI
description: The GitHub Actions workflows that gate pull requests into main, scan them for leaked labels, cut and publish releases, and refresh the capture frames
---

# CI

## Overview

Owns the workflows in `.github/workflows/` that verify a pull request, scan its text, release after a merge, and refresh the landing-page frames. CI runs the gate through one entry point, `bun run check:ci`, and `check:install` beside it. The stages themselves sit in `src/gate/` and are described in `canon/context/development/gates/index.md`.

## Layout

### `.github/workflows/`

`verify.yml` calls the gate once rather than naming each stage, so a stage added to `src/gate/stages.ts` is enforced with no workflow edit. The release and refresh workflows run on their own events, and the web previews belong to `canon/context/web.md`.

- `verify.yml` runs on pull requests into `main`, pushes to `main`, `merge_group`, dispatch, and a weekly cron that runs `dependency-advisories` alone
- The Install Plugin CLI step pins `@anthropic-ai/claude-code` exactly. Test a raised pin with `bun install -g` on a fresh runner, since `2.1.237` left a wrapper that cannot run.
- `release-please.yml` keeps a release pull request open, and merging it tags, rewrites `CHANGELOG.md`, and runs `publish` to npm. A lost publish is repaired by dispatching the workflow with `tag`.
- `refresh-capture-frames.yml` runs on `main` only and queues `gh pr merge --auto --squash`. Its push step rebuilds the branch on a fresh `main` and carries only the files it wrote or dropped.
- Each workflow states its own reasons in comments beside the line, such as the queued `concurrency` group, the `npm@11` install, and the credential preflight

### `src/gate/`

CI differs from a local run in scope and in what an unmeasured stage means. The stage list, the sequencer, and every threshold live here.

- A local `bun run check` scopes shell, types, and tests to the files changed against `origin/main`, while CI passes `--all`. Reproduce CI with `bun run check:ci`.
- A stage that could not read its input fails under `check:ci` and warns locally, where the closing line counts the stages that measured nothing
- Indexes and Consumed copies regenerate and then assert, so `check:ci` writes to the working tree even though it never formats
- Plugin manifests runs `claude plugin validate --strict` and skips locally without the CLI, but fails when `CI` is set
- Unreferenced rules and Audit set print what they find and never fail the push

### `src/labels/`

`phase-label-gate.yml` runs `canon labels scan` on the event payload, since a pull request body and a posted review are text no gate stage sees. It sits outside `verify.yml` because it needs `edited` on its trigger.

- It also triggers on `pull_request_review` and reads `review.body`, and its `if:` checks the base ref because that event carries no `branches` filter
- A release-please pull request is told apart by both the `release-please--branches--main` head prefix and the `chore(main): release ` title prefix
- The scan drops fenced blocks and blanks inline spans, but leaves link destinations, since a release body keeps its semver in a compare link
- `VERSION_SPAN` in `src/labels/phase.ts` reads a span holding only a version as a hit, so an author quoting a label alone in a span is still caught
- The seeded copy under `tooling/base/configs/.github/workflows/` runs `bunx -y @erclx/canon labels scan` with no install step, since a `python` target has no lockfile

### Other folders

The release configuration and the install check sit beside the workflows.

- `.claude-plugin/` and `claude/.claude-plugin/` hold the manifests release-please versions, and `.oxfmtrc.jsonc` ignores the files the tool writes
- `scripts/core/` owns `install-check.sh`, which packs, extracts, and installs the tarball in CI after `check:ci`, covered in `canon/context/cli/packaging.md`

## Gotchas

- `no checks reported on the '<branch>' branch` usually means a merge conflict, since such a branch has no merge ref to run on. Read `gh pr view --json mergeable,mergeStateStatus` and rebase.
- A green `🛡️ Static Checks` tested `refs/pull/<n>/merge` as of the last push. A personal repository holds no merge queue, so a sibling merge leaves it stale until the poll reads `STALE`.
- The job name `🛡️ Static Checks` is what the ruleset requires, so renaming it strands branch protection
- The runner installs no browser, so each `*.e2e.test.ts` skips itself and a green run does not show it ran. Verify those locally.
- The `merge_group` trigger is inert until a `merge_queue` rule exists, and a workflow with no job listening for the event never completes a queue entry
