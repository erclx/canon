# CI workflow template

## Contents

- [Base template](#base-template)
- [Splitting the check job](#splitting-the-check-job)
- [Targeting another platform](#targeting-another-platform)

## Base template

Copy this base template and adapt it to the project's stack, test commands, and build output. It carries the shape a new pipeline starts in, with the checks that share setup in one job, per the granularity rule in the skill body. `e2e` and anything gated on it stay separate jobs at either size.

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

jobs:
  checks:
    name: '🛡️ Checks'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run check
      - run: bun run test
      - run: bun run build
      - uses: actions/upload-artifact@v7
        with:
          name: build-output
          path: dist/

  e2e:
    name: '🎭 E2E Tests'
    needs: checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - uses: actions/download-artifact@v8
        with:
          name: build-output
          path: dist/
      - run: bun run test:e2e
      - uses: actions/upload-artifact@v7
        if: failure()
        with:
          name: e2e-results
          path: test-results/
          retention-days: 7
```

## Splitting the check job

Apply this once a run log puts the gate past roughly two minutes, never before. Each job below repays checkout, dependency install, and toolchain setup before it reaches a stage, which is the cost the duration has to cover. Replace the `checks` job above with these three and point `e2e` at `needs: build`.

```yaml
jobs:
  static:
    name: '🛡️ Static Checks'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run check

  unit:
    name: '🧪 Unit Tests'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run test

  build:
    name: '📦 Build Check'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run build
      - uses: actions/upload-artifact@v7
        with:
          name: build-output
          path: dist/
```

## Targeting another platform

Add this job beside the Linux ones only when the project states macOS as a supported platform, per the runner platform rules in the skill body. It runs the unit layer, since that layer differs by platform, and the rest stay on `ubuntu-latest`.

```yaml
jobs:
  unit-macos:
    name: '🧪 Unit Tests (macOS)'
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v7
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - name: Resolve the temp folder
        run: echo "TEMP_REAL=$(realpath "$RUNNER_TEMP")" >> "$GITHUB_ENV"
      - run: bun run test
```
