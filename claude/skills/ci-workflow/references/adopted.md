---
title: Adopted and declined
description: Which external sources on pipeline structure this skill adopted, which it declined, and why, so a later session extends the position instead of re-deriving it
---

# Adopted and declined

External sources were read and filtered rather than imported. This file is the record, and a later session extending the skill adds to it rather than re-arguing an item settled here.

It covers the sharding, summary job, and hand-started workflow rules. The rest of the body predates it and cites nothing yet.

## Adopted for where a suite runs

[Fowler, Continuous Integration](https://martinfowler.com/articles/continuousIntegration.html) keeps the commit build quick, since "The commit build is the one that has to be done quickly", and sends slower suites to later stages, where "Additional machines can run further testing routines on the build that take longer to do".

Adopted as end to end in its own job, behind the build alone and split across machines. What a push runs is `test-craft`'s half of the same source.

## Adopted for sharding

The two runners split a suite differently, which is why the body asks for the split unit before a count.

- [Playwright, Sharding](https://playwright.dev/docs/test-sharding): "Without the fullyParallel setting, Playwright Test defaults to file-level granularity, meaning entire test files are assigned to shards"
- [Vitest, Improving performance](https://vitest.dev/guide/improving-performance): "Vitest splits your test files, not your test cases, into shards"
- [GitHub, Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax): with `fail-fast` on, its default, "GitHub will cancel all in-progress and queued jobs in the matrix if any job in the matrix fails"

House choice: two shards to start and about three minutes as the trigger to raise the count, since a fresh scaffold has a handful of specs and each shard repeats checkout, install, and the browser install.

## Adopted for the summary job

Each source settles one half of why the job runs always and reads the result itself.

- [GitHub, Troubleshooting required status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks): the dependent job "is skipped and may not block merging", so "Use always() with needs for required checks that depend on other jobs."
- [GitHub, Contexts](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts): `needs.<job_id>.result` takes "success, failure, cancelled, or skipped", so the job accepts the one passing value rather than listing the failing ones

## Adopted for a hand-started workflow

Two GitHub pages give the limit and the way around it.

- [GitHub, Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows): `workflow_dispatch` "will only trigger a workflow run if the workflow file exists on the default branch"
- [GitHub, Workflows](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows): GitHub looks for "workflow files that are present in the associated commit SHA or Git ref of the event", so a push runs its own branch's file

House choice: the comparison shape, from a web app whose first design took 18.5 minutes for one round and whose proof took hand-edited pushes.

## Declined

Each item below stays out for the reason given.

- **A merged report job.** Playwright merges blob reports from every shard into one. Each shard's own report answers which spec failed, and a merge job adds a second aggregate beside the summary.
- **Requiring each shard.** GitHub can require every shard by name, and a shard's name carries the count, so raising it leaves the ruleset waiting on a name that never reports again.
- **Vitest's `--shard` by default.** It splits an even file count with no regard to duration, so a suite with a few long files gains less than the count suggests.
- **How a comparison measures.** Rounds, noise runs, and medians run inside the job, which this skill's requirement keeps out.
