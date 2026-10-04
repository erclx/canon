---
title: The pull request preview deploy
description: How canon pr preview finds a fenced Cloudflare Pages deploy, refuses a branch its push filter does not serve, dispatches it on a pull request's branch, reads the alias the run prints, the refusal reasons it names, and why an unfenced deploy is refused before anything runs
---

# The pull request preview deploy

`canon pr preview` publishes a pull request's branch to a Cloudflare Pages
preview and reports the address. `git-pr` calls it after the evidence
comparison, then re-renders that comment through `canon pr evidence --preview`
so the link sits on the address line under its heading. A reviewer gets a page
to click into before merging rather than screenshots and a checklist alone.

```bash
canon pr preview --json
canon pr preview 1341 --json --timeout 20
canon pr preview 1341 --check --json
```

## Which workflow it dispatches

The verb reads `.github/workflows/*.yml` and `*.yaml` in the checkout and picks
the first file, in path order, that meets four tests:

- It runs `pages deploy`.
- It carries a `workflow_dispatch` trigger, since nothing else lets a caller
  start it on a branch.
- Its deploy passes `--branch=${{ github.ref_name }}`.
- It prints a `canon-preview-alias:` line.

The workflow is read before the pull request, so a project with no fenced
deploy is refused without a network call.

## Which branches it serves

A dispatch runs the workflow whatever its `on.push.paths` filter says, so a
branch that touched nothing the site builds from would get a preview showing
none of its change. The verb reads the pull request's changed paths and matches
them against the picked workflow's own `on.push.paths` or `on.push.paths-ignore`
list, applying `!` patterns in order the way GitHub does. When nothing matches,
it refuses as `unserved` and dispatches nothing. `--check` answers `unserved`
the same way.

The push filter is the one statement of what the site builds from, since it
already decides when production deploys. A workflow with neither list, with no
push trigger, or that does not parse as YAML serves every change, so a project
whose every change ships keeps minting for every branch.

A removed path counts, the same as GitHub's own push filter counts it, so a
branch whose only site change deletes a file still gets a preview.

## Why an unfenced deploy is refused

Cloudflare Pages publishes a deploy that names no branch to production. A
dispatch from an unmerged branch through such a workflow ships that branch to
the live site, so the verb refuses as `unfenced` and dispatches nothing. The
fix is one flag on the deploy command, and the cloudflare stack's
`deploy.yml` already carries it.

## Where the address comes from

The workflow prints the alias Cloudflare returned for the deploy, read from
`wrangler-action`'s `pages-deployment-alias-url` output, on a fixed line:

```plaintext
canon-preview-alias: https://<alias>.<project>.pages.dev
```

The verb reads that line out of the finished run's log rather than computing
the address from the branch name. Cloudflare flattens a branch into its alias
and may truncate it, and a computed address that is wrong is worse than none.
The output needs wrangler 3.78 or later, so the workflow pins
`wranglerVersion`.

`gh workflow run` reports no run id. The verb lists the branch's dispatched
runs before dispatching and takes the one id that appears afterwards, which
keeps the match independent of the local clock.

## What the record carries

`reason` on the record is what a caller branches on, not the exit code:

| Reason               | What it means                                                              |
| -------------------- | -------------------------------------------------------------------------- |
| `ok`                 | The preview was published. `url` carries the address and `runId` the run.  |
| `no-deploy`          | No dispatchable workflow runs `pages deploy`.                              |
| `unserved`           | The push path filter matches no changed path, so nothing was dispatched.   |
| `unreadable-changes` | The pull request's changed paths could not be read.                        |
| `unfenced`           | The deploy passes no `--branch`, so nothing was dispatched.                |
| `no-alias`           | The workflow prints no alias line, or the finished run's log carried none. |
| `run-failed`         | The deploy run finished without succeeding. `runId` names it.              |
| `timeout`            | The run did not finish inside `--timeout` minutes, 15 by default.          |
| `bad-timeout`        | `--timeout` was not a positive number.                                     |
| `gh-missing`         | `gh` is not on the path.                                                   |
| `gh-failed`          | `gh` could not read the pull request, or list or dispatch the workflow.    |
| `no-branch`          | The pull request carries no head branch name.                              |
| `check-timeout`      | `--check` was combined with `--timeout`.                                   |

The exit is 0 on `ok` and 1 on every refusal. A `timeout` leaves the run
going, so the preview may still land after the verb has given up on it.

## Checking which head a preview was built from

`--check` dispatches nothing and waits on nothing. It lists the branch's
`workflow_dispatch` runs, takes the newest successful one by creation time, and
compares the head it ran at with the branch tip read from the remote. The tip
comes from the remote rather than the pull request object's `headRefOid`, which
lags a push. `--check` takes no `--timeout` and refuses one as `check-timeout`.

The alias serves the newest successful deployment for the branch and names no
sha, so the run listing is the only record of the built head. The
`workflow_dispatch` filter also drops the cleanup run a closed pull request
fires, which concludes `success` with its deploy skipped. A project that deploys
on `push` to a feature branch would need that filter widened.

| Reason     | What it means                                                         |
| ---------- | --------------------------------------------------------------------- |
| `fresh`    | The newest successful deploy built the tip. Exit 0.                   |
| `stale`    | It built an earlier head. `built` and `tip` name both. Mint again.    |
| `building` | A deploy of the tip is still running. Wait rather than minting again. |
| `no-build` | No deploy of the branch has succeeded.                                |

The record also carries `runId` for the deploy it read. The check covers the
hosted address only, so a local address has no run to read and stays unverified.
`review-ui` runs it before driving a hosted preview and posts nothing on any
reason but `fresh`.

## How the address reaches the pull request

`canon pr evidence --preview <url>` puts `**Preview:** <url>` on the address
line under the evidence body's `## Evidence` heading. With no evidence image in
the diff, the body is the heading, that line, and the trailing marker alone, so
a pull request whose screenshots did not change still gets one comment a later
call can find and edit.

A later `canon pr evidence` run without `--preview` reads the address off the
marked comment and carries it into the new body. `git-followup` re-renders the
comment after every push, and without that carry the first push would delete
the link. A visual checklist folded in through `--checklist` carries the same
way, which is what keeps that push from wiping boxes a reviewer already ticked.

## Removing a preview

A `pull_request` trigger on `closed` in the same workflow runs a cleanup job
that deletes every preview deployment Cloudflare holds for the branch. The
deploy job carries `if: github.event_name != 'pull_request'`, so a closed pull
request never deploys. The same close runs `canon pr local --remove`, which
drops the address line from the evidence comment, hosted link included, so the
comment never links a deployment that no longer exists.

## What this does not cover

The verb builds only the deployed-and-public case. A private repository whose
previews need access protection waits for a project that needs it. A local
server stands in where there is no deploy, through `canon docs pr-local`.
