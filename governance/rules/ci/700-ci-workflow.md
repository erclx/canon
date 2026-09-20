---
description: Enforce GitHub Actions job naming, granularity, dependency wiring, and bun pinning
paths:
  - '.github/workflows/**'
---

# CI workflow standards

## Triggers and pinning

- Include `workflow_dispatch` alongside the primary trigger on every workflow.
- Pin every action to a major version tag. Never `@latest` or `@main`.
- Run every job on `ubuntu-latest`.

## Job naming

- Name every job as an emoji followed by a title, such as `🛡️ Checks`, `🧪 Unit Tests`, `📦 Build Check`, `🎭 E2E Tests`, or `🚀 Deploy`.

## Job granularity

- Fold static analysis, unit tests, and build into one job while the gate runs under two minutes end to end.
- Split them into parallel jobs once a run log puts the gate past two minutes.
- Give E2E, release, and deploy a job each from the start.

## Job dependencies

- Use `needs` for a data dependency, where a job consumes another job's artifact, or for a job whose cost is prohibitive against the gate in front of it. Leave every other job unwired so it runs in parallel.
- Gate E2E on the job that uploads the build artifact.
- Gate release and deploy on E2E.
- Emit a deploy, publish, or release job with a placeholder step and name what the caller fills in. Never guess a deploy command.

## Artifacts

- Upload an artifact on `if: failure()` alone, with `retention-days: 7`.

## Bun stack

- Use `oven-sh/setup-bun@v2` with `bun-version: latest`.
- Install with `bun install --frozen-lockfile`.
- Key the Playwright browser cache on the Playwright version string, never a static key.

## Commit-back

- Commit a refreshed file back to the pull request branch only when the branch's own change moved it. Report the diff without committing when something outside the branch can move it, such as a count read at build time or a font that renders differently per machine, since that commit lands on a branch that never asked for it.
- Commit only what a deterministic step regenerates from source, and run the diff check before the commit step so an unchanged capture pushes nothing.
- Skip a pull request from a fork with `github.event.pull_request.head.repo.full_name == github.repository`, since the default token cannot push to a fork's branch.
- Set the concurrency group on the ref so a newer push cancels the run committing onto a stale head.
- Set `HUSKY: 0` on the commit step when the runner lacks a tool a hook shells out to.
- Never commit back to the trunk. A commit with no pull request and no reviewer needs an operator's decision, not a workflow's.
- Leave `workflow_dispatch` off a commit-back workflow. A manual run has no branch to commit onto, so the trigger would pass and do nothing.
- Fail a template's first step while a path list still holds its placeholder, so an unfinished install fails loudly rather than never firing.

## Authority

- Load the `canon:ci-workflow` skill for the workflow template and the per-project adaptation. Report it rather than proceeding silently when the skill does not resolve.
