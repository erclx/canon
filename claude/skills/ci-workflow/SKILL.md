---
name: ci-workflow
description: Generates GitHub Actions CI workflow files with parallel jobs, emoji job names, and gated deploy stages. Use when asked to "write a CI workflow", add GitHub Actions, set up a CI pipeline, or create a `.github/workflows` file.
metadata:
  family: generate
---

# CI workflow

Generate GitHub Actions workflow files for CI pipelines. Enforce parallel job execution, emoji job naming, and gated deployment stages.

## Guards

- A request for what runs inside a deploy, publish, or release job stops at the gate, since credentials, environments, and targets are invisible here. Never guess a deploy command.
- Emit such a job with its `needs` wiring and a placeholder step, then name what the caller fills in
- The build, test, and deploy commands belong to the project. Read them from its scripts rather than asserting a second copy in the workflow.

## Workflow setup

- Include `workflow_dispatch` alongside the primary trigger, except on a commit-back workflow, where a manual run has no branch to commit onto and would pass while doing nothing.
- Set `permissions: contents: read` at the top level, and grant a write scope only on the job that needs it.
- Pin all actions to major version tags (`@v4`, never `@latest` or `@main`).
- Use `runs-on: ubuntu-latest` for every job, except one the runner platform rules below move to another platform.

## Runner platform

Linux stays the default. A job leaves it only for a layer whose result differs by platform, and only on a platform the project states.

- Read the stated platforms from the project's requirements record or README. A platform stated in neither keeps every job on Linux.
- Keep lint, build, and browser jobs on Linux, since their result does not differ by platform. Name the layers that may leave it and never the steps they run.
- Name another runner by its `-latest` label, such as `macos-latest`, matching the `ubuntu-latest` convention above.
- Resolve a macOS temp path with `realpath` from `$RUNNER_TEMP` before comparing it with a tool's output. The `/var` to `/private/var` symlink hides the target.
- Expect a macOS job to cost more per minute than a Linux one. GitHub bills the two differently, so read the rate from its billing page rather than quoting a multiplier.

## Job naming

- Name jobs with emoji + title: `🛡️ Checks`, `🛡️ Static Checks`, `🧪 Unit Tests`, `📦 Build Check`, `🎭 E2E Tests`, `🚀 Deploy`, `🔍 Code Quality`, `🏷️ Release`, `🔒 Security`.

## Job granularity

- Start a new pipeline with static analysis, unit tests, and build in one job, since they share setup. A project with no run history has nothing to measure, and one job costs least to reverse.
- Keep them in one job while the gate runs under roughly two minutes. Each extra job repays checkout, dependency install, and toolchain setup, so a split at that duration costs more than it returns.
- Split once a run log puts the gate past that, then apply the dependency rules below. The run log is the trigger, since repository size and stage count answer nothing.
- Give E2E, release, and deploy their own jobs from the start. Each carries a data dependency or a gate, so this rule never folds them into the check job.

## Job dependencies

- Run independent jobs in parallel.
- Use `needs` only when there is a data dependency (a job requires an artifact) or the job is prohibitively expensive relative to its gate.
- Run static, unit, and build jobs in parallel once the gate is split.
- Gate E2E on whichever job uploads the build artifact, since it consumes that artifact. That job is the folded check job in a new pipeline and the separate build job once the gate is split.
- Gate release and deploy on E2E.

## Artifacts

- Upload artifacts on `if: failure()` only. Set `retention-days: 7`.

## Bun stack

- Use `oven-sh/setup-bun@v2` with `bun-version: latest`.
- Install with `bun install --frozen-lockfile`.
- Cache Playwright browsers keyed on the Playwright version string, never a static key.

## Commit-back

A workflow that pushes a regenerated file onto the pull request branch takes these on top of the setup above.

- Set the concurrency group on the ref so a newer push cancels the run committing onto a stale head.
- Set `HUSKY: 0` on the commit step when the runner lacks a tool a hook shells out to.
- Fail a template's first step while a path list still holds its placeholder, so an unfinished install fails loudly rather than never firing.

## Template

Load `${CLAUDE_SKILL_DIR}/references/workflows.md` for the base workflow template. Adapt it to the project's stack, test commands, and build output. Add or remove jobs as needed. The template already carries the folded shape, and the split beside it applies once the granularity rule above calls for it.

## Validation

Before responding, verify:

- `workflow_dispatch` is present alongside the primary trigger, and absent from a commit-back workflow.
- The top-level `permissions` reads `contents: read`, and every write scope sits on a job.
- All actions pinned to major version tags, no `@latest` or `@main`.
- A new pipeline folds static, unit, and build into one job, and a gate a run log put past two minutes gives them no `needs` so they run in parallel.
- Every name in a `needs` matches a job declared in the same file. E2E names the artifact producer, release and deploy name E2E.

### Artifacts, names, and deploys

Before responding, also verify:

- Artifacts upload on `if: failure()` only with `retention-days: 7`.
- Job names use emoji + title format.
- Every job runs on `ubuntu-latest`, except one that targets a platform the project states and runs a layer that differs by platform.
- Deploy, publish, and release jobs carry a placeholder step and a named handoff, never a guessed deploy command.
- Bun projects use `oven-sh/setup-bun@v2` with `bun install --frozen-lockfile`.
