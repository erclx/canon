---
title: Pull request preview and local server
description: How canon pr preview mints and checks a deploy, refuses unserved changes, and how canon pr local finds the branch's dev server
---

# Pull request preview and local server

`canon pr preview` and `canon pr local` put an address for the branch on the evidence comment. `canon/context/cli/commands/pr.md` carries the rest of the pr verbs, and `canon/context/cli/commands/pr-evidence.md` the comparison the comment renders.

## Decisions

### `pr preview` writes to the world

It is the one verb under `pr` that dispatches a deploy. `src/pr/preview.ts` refuses a workflow in which any `pages deploy` line lacks `--branch=${{ github.ref_name }}`, reading with YAML comment lines dropped.

Cloudflare Pages publishes an unfenced deploy to production, and a fence named only in a comment would otherwise pass for one.

### The alias comes from the run log

It reads the preview alias off a `canon-preview-alias:` line in the finished run's log rather than computing it from the branch name, since Cloudflare flattens and may truncate a branch into its alias.

`gh workflow run` returns no run id, so the run is the one id absent from a listing taken before the dispatch, which keeps the match off the local clock.

### The address reaches the pull request

It lands on the address line under the evidence body's `## Evidence` heading through `canon pr evidence --preview`. A later render without the flag carries the address forward off the marked comment, so `git-followup`'s re-render after a push keeps the link.

An unreadable comment thread refuses as `gh-failed` rather than rendering blind, since a body built without it knows neither the comment to edit nor the address to carry.

### `pr preview` refuses `unserved`

It refuses, mint and `--check` alike, when the deploy workflow's own `on.push.paths` or `paths-ignore` filter matches no path the pull request changed. The evidence comment on #2221, a canvas-only branch, linked a landing-page deploy because `git-pr` minted whenever a checklist or evidence posted.

The only deploy run on that branch was a `workflow_dispatch` run, which GitHub starts without consulting the push filter.

### The filter is the source

It already decides when production deploys, and a second path list in canon config would drift from it. `readServedPaths` parses it with `Bun.YAML` and `servesChange` matches each changed path with `Bun.Glob`, applying `!` patterns in order as GitHub does.

The changed set comes off `listPullFiles`, the REST read the evidence render takes. Removed paths count here though the render skips them, since GitHub's own push filter counts a deletion.

### A workflow that cannot be read serves everything

A workflow with neither filter, with no push trigger, or that fails to parse serves every change. A wrong `unserved` stops all four readers of `readOwed` asking for a preview and lets the draft lift clear a branch whose site never deployed.

### Effects of `unserved`

The refusal changes what the other readers report.

- `pr evidence --check` stops owing `preview` on such a branch
- A render drops a carried hosted address the change does not reach, keeping an explicit `--preview`
- This repository's `deploy-site.yml` excludes `assets/evidence/**` from its `assets/**` entry, since the page reads nothing there and every branch carrying screenshots otherwise read as served
- Measured at `a4f823022` on 2026-10-04

### Fixtures need valid YAML

A workflow fixture whose alias step reads `run: echo "canon-preview-alias: $URL"` unquoted is not valid YAML, since `: ` inside a plain scalar opens a mapping. `Bun.YAML.parse` throws and the reader serves every change, so a test exercising a filter writes that step as a block scalar.

### `pr preview --check`

It answers whether the preview a reviewer is about to drive was built from the branch tip. `review-ui` posted `## UI review closed` on `#2051` against a build of an earlier head with nothing comparing the two.

The newest successful `workflow_dispatch` run is the source, since the alias serves the newest successful deployment per branch and names no sha.

### How the build head is read

Three details keep the comparison honest.

- `readPreviewHead` orders runs by `createdAt` rather than list position, and reads a run still going at the tip as `building` rather than `stale`
- The `--event workflow_dispatch` filter is load-bearing, since the `pull_request: closed` cleanup run concludes `success` with its deploy skipped and would read as a fresh build
- The tip comes from `resolveTip` against the remote, not the lagging `headRefOid`

### What `--check` leaves open

Enforcing it in the ship chain by re-minting on push was the alternative, a second surface that stays a follow-up. Reading `built` off the alias URL was rejected, as the alias carries no sha.

The local rung and a launch-named address have no run to read and stay unverified, as does a hand-run `wrangler` deploy the run listing never sees.

### `pr local` finds the server by cwd

`canon pr local` finds the branch's dev server by the working directory of each listening process rather than deriving a port. A port helper needs a per-stack base the toolkit cannot know and misses a server started by hand.

`src/pr/local.ts` keeps a listener whose cwd sits inside the worktree toplevel, subfolders included, and excludes everything under `.claude/worktrees/` so the main checkout never reports a linked worktree's server.

### The probe counts HTML only

It counts only a port serving `text/html` at `/`, because a run from the main checkout here found a Playwright test server answering a bare 404 in the same tree.

### The local link

It lands as a `**Local preview:**` segment after any hosted one on the address line through `canon pr evidence --local`. It does not flip `no-evidence` by itself, though a checklist does, so a docs-only branch with a server up posts no link-only comment.

### `--remove` drops the address line

A seeded `pull_request: closed` workflow drops the whole address line with `--remove`, the one path where the verb edits the comment itself, since that caller has no session to post a body.

It drops the hosted segment too and leaves no note, because the deploy workflow's cleanup job deletes the branch's preview deployments on the same close and a tombstone sentence outlived the links on #2212.

### Finding the address line

The reader scans the region above the commit line, checklist, or comparison for each prefix wherever it sits, so a comment in the older layout, opening on the addresses rather than the heading, reads the same.

The workflow covers close alone, so a link whose server stopped mid-review stays up until then. Measured at `18c5aa17` on 2026-09-25.

### Listeners come from `/proc` first

The machine runner reads listeners from `/proc` wherever `/proc/net/tcp` exists and turns to lsof only without it, or when both tables fail to read.

lsof 4.95, which Ubuntu 24.04 ships, drops every process whose kernel-truncated name holds an unmatched `(`. Next's `next-server (vX.Y.Z)` title truncates to `next-server (v1`, so an lsof-first order answered `no-server` for every Next dev server on such a machine.

### Why not fall back only when lsof finds nothing

Falling back to `/proc` only when lsof found nothing inside the worktree keeps two readers that disagree in exactly that case. The price of `/proc` first is a scan of about 341 ms against 49 ms for lsof over 3791 fds. Measured at `f6a2d68b` on 2026-09-25.
