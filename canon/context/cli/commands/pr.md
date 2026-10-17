---
title: Pull request verbs
description: The pr verbs that key on a commit, the review marker, the tick and owed checks, and false-green check runs
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

### Three verbs have their own entries

Their decisions kept this entry past the line ceiling.

- The comparison `canon pr evidence` renders is in `canon/context/cli/commands/pr-evidence.md`
- `canon pr preview` and `canon pr local` are in `canon/context/cli/commands/pr-preview.md`
- `canon pr frames` is in `canon/context/cli/commands/pr-frames.md`

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

It reads the pull request rather than a session's account of what it ran, since a session that stops after opening the pull request is the one whose account is missing, and a branch it leaves reads the same as one that needed neither step.

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
