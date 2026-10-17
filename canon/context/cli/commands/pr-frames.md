---
title: Pull request frames
description: How canon pr frames stores review images on one ref, why links name the path, and the ref name and its drain
---

# Pull request frames

`canon pr frames` stores the images a review comment embeds. `canon/context/cli/commands/pr.md` carries the rest of the pr verbs.

## Decisions

### `pr frames`

`canon pr frames` is the second verb under `pr` that writes to the world. An add writes one ref, `refs/heads/canon/frames`, through the git data API, so the reviewer calling it checks nothing out.

It exists because `review-ui` could only describe a frame in words, since nothing outside the merge path held an image a review comment could embed.

### The store was settled on 2026-10-02

The branch never merges and holds only frames the worker's evidence lacks, which `review-ui` decides by matching a box against the `states` `canon pr evidence` reports, a judgment the verb never makes.

- A local clone of the branch lost because it needs a worktree the reviewer may not enter
- Dropping frames at close lost because it breaks a recent review's images the moment its pull request merges

### Frames logic and its cost

`src/pr/frames.ts` keeps the logic behind an injected `FramesApi`, so a test drives the git object model in memory.

The cost is history. A plain delete would keep every image reachable, so `--drop` and `--prune` write a root commit and force-move the ref.

### Links name the path, not a commit

The rewrite is why. A commit-pinned link to any other pull request's frame went unreachable at every drop and resolved only until GitHub collected it.

A path link mutates when its file does, so the path carries a pass segment, the compact UTC instant `review-ui` records at its first step. A second pass at one head and box writes a new file rather than changing an image an earlier comment shows.

### Theme paths

A taste box's dark and light shots take one `box-<n>-<theme>.png` path each through `--theme`, so two pushes for one box in one pass land apart. A frame with no theme keeps the plain path. Refusing the overwrite lost, since a preview minted again at one head needs a second pass there.

### Pruning runs daily

`--prune 30` runs from `pr-frames-cleanup.yml` rather than on `pull_request: closed`, with the expiry selection in the verb where a test reaches it. A target project carries no such workflow yet.

### The branch name

The branch was `canon-frames` until 2026-10-12, when the operator settled `canon/frames`. A bare name read as neither a work branch nor a platform data branch, and it listed in every target as a branch thousands of commits behind `main`. A namespace names its owner.

### Three alternatives lost

Each alternative failed on a measured cost.

- Keeping the name left that listing as it was
- A bare data name such as `frames` claims a word a project may already hold
- A non-branch ref such as `refs/canon/frames` has no blob link on GitHub, since the 2026-10-12 probe of `refs/pull/1/head` returned 404, though a custom ref was never probed

### The old ref drains

A target holding the old ref drains it through `--prune` as its pull requests expire rather than losing its links at once. `--drop` and `--prune` run against it after the current branch, remove only, and delete it once empty. An add never writes it.

The drain stays until the operator removes it by hand, since it costs one extra read and removing it early strands a target that never ran the verb.

### A branch named `canon` blocks the ref

A repository holding a branch literally named `canon` cannot create `canon/frames`, and the add reports `push-failed`.
