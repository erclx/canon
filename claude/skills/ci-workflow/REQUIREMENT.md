---
name: ci-workflow
description: Scope boundary for pipeline structure against job contents, and the reproducibility rules under it
---

# CI workflow requirement

## Gap

Without this skill, a session chains jobs with `needs` to express reading order rather than a data dependency, so the pipeline costs the sum of its jobs. The same session splits a one-minute gate into parallel jobs, each repaying checkout, install, and toolchain setup, so the gate gets slower while reporting no earlier.

The rest surface as flakes or stalls:

- A moving action ref changes under the project, and a static cache key serves a stale toolchain
- Artifacts never expire, and a broad default token grants unneeded writes
- A missing manual trigger leaves a run reproducible only by pushing a commit
- A Linux-only pin flags a supported macOS job as a departure
- A Playwright install calling apt directly hangs on a stalled mirror and, with no step bound, holds the runner until the six-hour job default

## Must

- A job is gated only on a data dependency or a cost that justifies the wait, and checks sharing setup stay in one job until a run log puts the gate past roughly two minutes
- Every action is pinned to a tag that cannot cross a major version, every cache is keyed on the version of what it caches, and every Playwright install is bounded and retried
- Every workflow carries a manual trigger beside its primary one, except one that commits back
- The token defaults to read-only, with a write scope granted only on the job that needs it, and artifact upload is bounded to failures and expires
- A job runs on Linux unless the project states a platform for a layer that differs by platform

## Must not

- Own what runs inside a job, or guess a deploy command. A deploy, publish, or release step gets its `needs` wiring and the inputs the caller fills in.
- Enumerate the job set as a fixed list

## Out of scope

- Secrets, environments, and deploy targets, which live in the repository settings
- The deploy setup on a host, which `deploy-app` owns
- CI systems other than GitHub Actions, which a separate skill would own
