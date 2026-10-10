---
name: ci-workflow
description: Scope boundary for pipeline structure against job contents, and the reproducibility rules under it
---

# CI workflow requirement

## Gap

Without this skill, a session writes a pipeline whose jobs run in sequence because `needs` was used to express the order a person reads them in rather than a data dependency. The pipeline then costs the sum of its jobs where it could have cost the longest one, and the waste compounds on every push.

The same session splits a gate that finishes in a minute into three parallel jobs, which fails in the other direction. Each job repays checkout, dependency install, and toolchain setup before it reaches a stage, so the gate gets slower while reporting no earlier, and the roster reads as a design decision rather than as a cost nobody measured.

The rest are reproducibility failures that surface as flakes. An action pinned to a moving ref changes under the project, so a run that passed yesterday fails today with no commit behind it and the diff explains nothing.

A cache keyed on a static string serves a stale browser or toolchain after a version bump, and the failure reads as a broken test rather than a stale cache. Artifacts upload on every run and never expire, so storage grows with the commit count while the ones worth reading are the failures. And a workflow with no manual trigger can only be reproduced by pushing a commit, which is the wrong instrument for a run that failed for an environmental reason.

## Must

- Gate a job only on a data dependency or on a cost that justifies the wait, and leave every other job parallel
- Start the checks that share setup in one job and split them only once a run log puts the gate past roughly two minutes
- Pin every action to a tag that cannot cross a major version
- Key a cache on the version string of the thing it caches
- Give every workflow a manual trigger beside its primary one
- Bound artifact upload to failures and set an expiry on it

## Must not

- Own what runs inside a job. The build, test, and deploy commands come from the project, and a workflow asserting its own is a second copy of the project's scripts.
- Enumerate the job set as a fixed list. Projects add and remove jobs, and what has to survive that is the parallel and gated structure rather than the roster.

## Guards

- A request for a deploy, publish, or release step stops at the gate. The job's contents carry credentials and an environment this skill cannot see, so it emits the `needs` wiring and names what the caller has to fill in rather than guessing a deploy command.

## Out of scope

- Secrets, environments, and deploy targets, which live in the repository settings rather than in the workflow this skill writes
- CI systems other than GitHub Actions. The structure rules generalize and the file format does not, so a different system is a different skill rather than a flag on this one.
