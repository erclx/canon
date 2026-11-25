---
title: Comparison workflow
description: The shape of a hand-started workflow that compares two commits, and the throwaway branch that proves any hand-started workflow before its file reaches the default branch
---

# Comparison workflow

## Contents

- [The shape](#the-shape)
- [Template](#template)
- [Proving a hand-started workflow](#proving-a-hand-started-workflow)

## The shape

A comparison workflow answers how two commits differ, such as in speed. It holds the triggers, the two sides, and the call into the project's harness. How the harness measures, repeats, and reports a run stays out of the workflow file.

- Start it by hand alone, with `workflow_dispatch` as its only trigger. It answers a question somebody asked, so no pull request waits on it.
- Gate nothing on it. No job names it in `needs`, and no ruleset requires it.
- Take any two refs as inputs, so a commit older than the workflow can be a side.
- Build each side in its own worktree of one full clone, since a switch between refs in one tree leaves the first side's build behind.
- Drive both sides from outside, with the harness run from the checkout the workflow came from. A commit older than the harness then needs none of its code.

## Template

Copy this template and replace the two script calls with the project's own. A branch input is written `origin/<branch>`, since a full clone holds every other branch as a remote ref alone.

```yaml
name: Compare

on:
  workflow_dispatch:
    inputs:
      base:
        description: Commit, tag, or origin/<branch> to compare against
        required: true
        type: string
      head:
        description: Commit, tag, or origin/<branch> under comparison
        required: true
        type: string

permissions:
  contents: read

jobs:
  compare:
    name: '📊 Compare'
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - name: Check out both sides
        env:
          BASE_REF: ${{ inputs.base }}
          HEAD_REF: ${{ inputs.head }}
        run: |
          git worktree add --detach "$RUNNER_TEMP/base" "$BASE_REF"
          git worktree add --detach "$RUNNER_TEMP/head" "$HEAD_REF"
      - name: Build the base
        run: bash scripts/build-side.sh "$RUNNER_TEMP/base"
      - name: Build the head
        run: bash scripts/build-side.sh "$RUNNER_TEMP/head"
      - name: Compare
        run: bun scripts/compare.ts "$RUNNER_TEMP/base" "$RUNNER_TEMP/head"
```

## Proving a hand-started workflow

GitHub offers a hand-started run only once the file is on the default branch, so a pull request adding one merges unproved. A push runs the workflow file its own branch carries, so a throwaway branch runs the jobs first.

1. Branch one commit past the pull request's head, such as `proof/compare`.
2. In that commit, add `push: branches: [proof/compare]` to the triggers and write a literal ref in place of each `inputs` value, which a push leaves empty.
3. Push the branch, find the run with `gh run list --branch proof/compare`, and read it to the end.
4. Delete the branch from the remote and locally, and link the run from the pull request.

### What the proof covers

The run proves the jobs and their steps, and never the input form.

- Keep the trigger off the pull request's own branch, so no reviewer has to check that a later commit took it back out
- Fix what the run shows on the pull request's branch, then repeat the proof from the new head
- Start one run by hand after the merge, since the inputs are the one part the push replaced
