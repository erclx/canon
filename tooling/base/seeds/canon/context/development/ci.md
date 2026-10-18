---
title: CI
description: GitHub Actions workflow triggers and checks
---

# CI

## Overview

Owns the GitHub Actions workflow that gates a merge, being which events start a run and which checks have to pass before the branch can land. The checks call package scripts rather than defining commands of their own, so what each one runs is the setup entry's subject.

## Layout

### `.github/workflows/`

Holds `verify.yml`, the workflow that gates a merge. A pull request targeting `main` starts it, and so does a manual `workflow_dispatch` run from the Actions tab.

- Every job must pass before merge
- The Format check runs `bun run check:format` and asserts oxfmt is clean

## Gotchas

- `bun run check` runs the same assert as CI and writes nothing, so a CI format failure is fixed by running `bun run format` locally and committing the diff
