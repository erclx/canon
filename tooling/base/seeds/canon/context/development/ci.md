---
title: CI
description: GitHub Actions workflow triggers and checks
---

# CI

## Overview

Owns the GitHub Actions workflows, chiefly the one that gates a merge, being which events start a run and which checks have to pass before the branch can land. The checks call package scripts rather than defining commands of their own, so what each one runs is the setup entry's subject.

## Layout

### `.github/workflows/`

Holds `verify.yml`, the merge gate. A pull request targeting `main` starts it, and so does a manual `workflow_dispatch` run from the Actions tab. The synced stacks add other workflows beside it, and each file's `on:` block names what starts it.

- Every job must pass before merge
- The Format check runs `bun run check:format` and asserts oxfmt is clean

## Gotchas

- A push runs the full suite and the build where `package.json` declares no `test:changed`. Declare that script only once a job here runs both, since it takes them off the push.
- `bun run check` runs the same assert as CI and writes nothing, so a CI format failure is fixed by running `bun run format` locally and committing the diff
