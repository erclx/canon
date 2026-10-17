---
title: Pull request verbs
description: The pr verbs that key on a commit, the review marker, evidence and preview comments, the local server read, and false-green check runs
---

# Pull request verbs

## Decisions

### `pr head` and `pr checks` key on the remote tip

Both resolve the branch tip through `git ls-remote` and key what they report on that sha. `gh pr view --json headRefOid` reads a pull request field that trails the branch ref by up to a minute after a push, and says nothing about the trail.

They read the remote rather than the remote-tracking ref, since a tracking ref is only as current as the last fetch and the push worth catching is the one the process never saw.

### The cost of the remote read

Roughly half a second against 0.001s for the local read, sampled at 0.41s, 0.55s, and 0.67s across two days, on callers that already spend a `gh` round trip on the same line.

`docs/agents/pr-reads.md` carries why that spend is right in the orchestrator poll and wrong in `canon targets pulls`, a question about what each reading decides rather than what it costs.

### `pr review-state`

It is the third verb under `pr` that exists because a GitHub field answers a different question than the caller's. `commit.oid` and `submittedAt` on a review are stamped at submission, so a push landing between a pass's read and its post moves both onto a commit that pass never opened.

`review-pr` writes the commit it read and the instant it read it as an HTML comment on the last line of every body it posts.

### The marker has one parser

`src/pr/review-scope.ts` parses the marker off the newest pass in the review family, falling back to the two stamps for a pass posted before the mechanism shipped. `source` on the record names which answered.

It is the only parser of the format, which stops the shipped skill body and the shipped `poll.ts` from carrying a copy each on two release cadences.

### Every read runs on REST

A cloud session's GitHub proxy refuses GraphQL, and every `gh pr view` and `gh repo view` runs on it. `src/pr/rest.ts` is the one boundary where the pulls, reviews, and issue-comments payloads meet the field names `review-scope.ts`, `evidence.ts`, and `withMergeState` were written against.

Keeping GraphQL locally and falling back to REST after a 403 was rejected, since it doubles the test surface for one field.

### `mergeStateStatus` is derived

REST lacks the field. `mergeable_state` holds the same values in lower case, so `mergeStateOf` raises it, and `unknown` stays `UNKNOWN` while GitHub computes it lazily, which `withMergeState` reads as not conflicted.

### A call with no number

It lists `pulls?head={owner}:<branch>&state=open` and refuses `ambiguous-pull` on two rows rather than taking the first, since two open pull requests on one head against different bases are both real.

### Paginated reads emit one line per row

The reviews and comments reads pass `--paginate` and emit one `@json` line per row. A filter reshaping each row makes `--paginate` emit one value per page, and a `last` inside the filter would answer for each page rather than the thread.

A refused page refuses the verb as `gh-failed` rather than reading as no reviews.

### A stub `gh` guards the boundary

`src/commands/pr.test.ts` drives each verb through a stub `gh` that 403s any `pr`, `repo view`, or `graphql` call, so a reintroduced one fails the suite.

### The evidence comparison has its own entry

`canon pr evidence` renders at `canon/context/cli/commands/pr-evidence.md`. Its decisions outgrew a paragraph and kept this entry past the line ceiling.

### `pr tick`

`canon pr tick` ticks the checklist boxes `review-ui` passed, as `- [x] <box> · passed at <short sha>`. A render at any other head clears the tick and drops the stamp.

It is a verb rather than a skill edit so two rules a driver could talk itself out of hold as checks. A taste box is refused, and so is a head that is not the remote tip, each writing nothing.

### The stamp is visible text

The operator reads it on the merge record, and a hidden head would serve the machine alone. A tick with no stamp, added by hand, is cleared when the render's head differs from the head in the comment's marker, since it names no head and a newer one has not earned it.

### Ticks and renders share one comment

`settleChecklist` runs inside `runEvidence`, and a checklist the marked comment carries opens a body on its own, so a push to a checklist-only branch re-renders instead of reporting `no-evidence`.

The tick and the re-render both `PATCH` one comment, and a render rereads the thread itself, so the window in which it could overwrite a tick is one `gh` round trip.

### `pr evidence --check`

It reports which post-pull-request steps of the ship chain never landed, as `owed` drawn from `evidence` and `preview`, through `readOwed` over the same API changed set and thread the render reads.

It reads the pull request rather than a session's account of what it ran, since a session that stops after opening the pull request is the one whose account is missing.

### Four surfaces read `owed`

The same read serves four callers.

- `role-orchestrator`'s draft lift
- The `git-pr` run on every pull request
- The closing read of `git-ship`
- Step 5 of `git-followup`

The draft lift reads it by number from outside the branch, which matters because a session that skipped the chain would skip a check inside it too. A new verb would have restated both reads.

### What `owed` cannot tell

The thread cannot tell a skipped preview from a failed deploy, so both read as owed and the cause stays with the worker. The deploy workflow is read from the checkout, so a pull request changing its own deploy reads against trunk's.

A checklist-only branch posts a marked comment, so it reads as owing a preview once that comment exists.

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

### `checks` imports `rollup` across a boundary

`src/pr/checks.ts` imports `rollup` from `src/targets/pulls.ts` rather than writing a second collapse. The import reads backwards, and the alternative was a third module both import from, at the cost of moving a function two callers already share correctly.

The boundary carries a vocabulary conversion. `rollup` reads the GraphQL enum the pull request listing returns and the REST check-run row spells its statuses lowercase, so `adapt` raises each row into upper case and maps a null conclusion onto an absent one.

### Check-run shapes that read as a false green

Keying a query on a sha is necessary and not sufficient. `repos/{owner}/{repo}/commits/<sha>/check-runs` answered with `total_count` 2 and an empty row list during a measured window, so a reader finding no run for the tip and reporting `passing` reproduces the false green behind a better query.

Both empty shapes report `pending`. `matched` and `foreign` on the record let a caller separate a tip with no run yet from one whose listing describes another commit.

### Foreign runs are tested first

The foreign test runs ahead of the collapse, so a mixed listing never gets a verdict off the half that happens to match.

### Truncation

The endpoint pages at 30 by default, so a commit carrying more check runs comes back short with `total_count` naming the whole. Collapsing the page in hand reports `passing` off a set a failing run can sit outside of.

`runChecks` asks for 100, the endpoint's maximum, and `collapseChecks` reads `reported` above the rows it holds as `pending` whatever they say. The ceiling only moves the boundary and the guard makes crossing it report unread, so the two compose. Measured at `e6ac473f` on 2026-09-02.

### A conflicted branch

No merge ref exists for a `pull_request` workflow to run on, so the empty listing never fills. The record carries `conflicted` beside `state` rather than a fourth `state` value, since the rollup and `canon targets pulls` branch on the three-value `ChecksState` and a fourth would fail open in any caller without a default arm.

`withMergeState` sets it only on `DIRTY` with `matched` 0, so a conflict arising after runs completed keeps their verdict.

### A re-triggered gate

A check re-run after a body edit leaves both the stale failed run and the fresh passing run on the same head, and a naive fold can count the failed one.

- `newestPerCheck` groups the matched set by name and keeps the run with the highest `id` per group
- A run with no name keys on its own position, so it never joins another nameless run's group
- `collapsed` on the record counts what the fold discards, so a caller reading it against `matched` sees the dedupe rather than a state disagreeing with `gh pr checks`
- Measured at `50c523f5` on 2026-09-02
