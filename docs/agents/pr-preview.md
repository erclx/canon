---
title: The pull request preview deploy
description: How canon pr preview finds a fenced Cloudflare Pages deploy, dispatches it on a pull request's branch, reads the alias the run prints, the refusal reasons it names, and why an unfenced deploy is refused before anything runs
---

# The pull request preview deploy

`canon pr preview` publishes a pull request's branch to a Cloudflare Pages
preview and reports the address. `git-pr` calls it after the evidence
comparison, then re-renders that comment through `canon pr evidence --preview`
so the link opens it. A reviewer gets a page to click into before merging
rather than screenshots and a checklist alone.

```bash
canon pr preview --json
canon pr preview 1341 --json --timeout 20
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

| Reason        | What it means                                                              |
| ------------- | -------------------------------------------------------------------------- |
| `ok`          | The preview was published. `url` carries the address and `runId` the run.  |
| `no-deploy`   | No dispatchable workflow runs `pages deploy`.                              |
| `unfenced`    | The deploy passes no `--branch`, so nothing was dispatched.                |
| `no-alias`    | The workflow prints no alias line, or the finished run's log carried none. |
| `run-failed`  | The deploy run finished without succeeding. `runId` names it.              |
| `timeout`     | The run did not finish inside `--timeout` minutes, 15 by default.          |
| `bad-timeout` | `--timeout` was not a positive number.                                     |
| `gh-missing`  | `gh` is not on the path.                                                   |
| `gh-failed`   | `gh` could not read the pull request, or list or dispatch the workflow.    |
| `no-branch`   | The pull request carries no head branch name.                              |

The exit is 0 on `ok` and 1 on every refusal. A `timeout` leaves the run
going, so the preview may still land after the verb has given up on it.

## How the address reaches the pull request

`canon pr evidence --preview <url>` puts `**Preview:** <url>` on the first line
of the evidence body. With no evidence image in the diff, the body is that line
and the trailing marker alone, so a pull request whose screenshots did not
change still gets one comment a later call can find and edit.

A later `canon pr evidence` run without `--preview` reads the address off the
marked comment and carries it into the new body. `git-followup` re-renders the
comment after every push, and without that carry the first push would delete
the link. A visual checklist folded in through `--checklist` carries the same
way, which is what keeps that push from wiping boxes a reviewer already ticked.

## Removing a preview

A `pull_request` trigger on `closed` in the same workflow runs a cleanup job
that deletes every preview deployment Cloudflare holds for the branch. The
deploy job carries `if: github.event_name != 'pull_request'`, so a closed pull
request never deploys.

## What this does not cover

The verb builds only the deployed-and-public case. A private repository whose
previews need access protection, and a project with no deploy at all where a
local server would stand in, both wait for a project that needs them.
