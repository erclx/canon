---
description: Keep GitHub Actions commit-back steps and token scopes safe, and route workflow authoring to the ci-workflow skill
paths:
  - '.github/workflows/**'
---

# CI workflow standards

## Authority

- Load the `canon:ci-workflow` skill for triggers, pinning, job shape, artifacts, and the Bun stack. Report it rather than proceeding silently when the skill does not resolve.

## Commit-back

- Commit a refreshed file back to the pull request branch only when that branch's change moved it. Report the diff when an outside input can move it, such as a build-time count or a font.
- Commit only what a deterministic step regenerates from source, and run the diff check before the commit step so an unchanged capture pushes nothing.
- Skip a pull request from a fork with `github.event.pull_request.head.repo.full_name == github.repository`, since the default token cannot push to a fork's branch.
- Never commit back to the trunk. A commit with no pull request and no reviewer needs an operator's decision, not a workflow's.

## Steps

- Keep an inline `run:` step to five lines at most with one guard allowed and no other branching, loop, trap, or function, and call a script for anything longer, per the `canon:ci-workflow` skill.

## Token scopes

- In a workflow with more than one job, add a write scope to the job that needs it, never to the workflow-level block, so every other job keeps the read-only token.
