---
title: Claude Code routines
description: Cloud-run agents triggered by schedule, API, or GitHub events
---

# Claude Code routines

A routine is a saved Claude Code configuration that runs autonomously on Anthropic-managed cloud infrastructure. Each routine bundles a prompt, one or more GitHub repositories, an environment, MCP connectors, and one or more triggers. Runs continue when your laptop is closed. Source: Anthropic, in the [Claude Code docs](https://code.claude.com/docs).

Routines are in research preview. API surface and limits may change. Available on Pro, Max, Team, and Enterprise plans with Claude Code on the web enabled.

## Triggers

A routine starts when one of its triggers matches. A single routine can mix all three types.

- Schedule: recurring cadence with a one-hour minimum interval. Times are entered in your local zone and converted automatically. Runs may start a few minutes after the scheduled time due to stagger
- API: per-routine HTTP endpoint at `https://api.anthropic.com/v1/claude_code/routines/<id>/fire`. Requires a per-routine bearer token and the `experimental-cc-routine-2026-04-01` beta header. Optional `text` body field passes freeform context to the run
- GitHub: reacts to repository events such as pull requests, pushes, issues, releases, workflow runs, and check runs. Supports filters on author, branches, labels, draft state, and fork origin. Requires the Claude GitHub App installed on the repo

## Creating a routine

Three surfaces, all writing to the same cloud account:

- Web: `claude.ai/code/routines`. Only surface that can configure API and GitHub triggers
- CLI: `/schedule [description]` walks through the same form conversationally. Creates schedule-only triggers. API and GitHub triggers require the web surface.
- Desktop: `New task` then `New remote task`. `New local task` instead creates a [Desktop scheduled task](https://code.claude.com/docs/en/desktop-scheduled-tasks), which runs on your machine and is not a routine

CLI also supports `/schedule list`, `/schedule update`, and `/schedule run` for managing existing routines.

## Branch safety

Claude can only push to branches prefixed with `claude/` by default. Toggle `Allow unrestricted branch pushes` per-repo to opt out. Each repository is cloned at the start of every run, starting from the default branch unless your prompt says otherwise.

## Identity and limits

A routine runs as your individual claude.ai account. Commits, pull requests, and connector actions appear under your linked identity. Routines are not shared with teammates and count against your account's daily run cap. When the cap or subscription usage is hit, organizations with extra usage enabled keep running on metered overage.

## Distinction from related features

- `/loop` (see [commands](commands.md)) repeats a prompt within an open CLI session. Local, ephemeral
- Desktop scheduled tasks run locally on your machine with access to local files. Not routines
- [GitHub Actions](https://code.claude.com/docs/en/github-actions) runs Claude in your CI pipeline on repo events. Lives in your repo, not your account

For the full reference, including supported events, filter fields, and the `/fire` API contract, see the [official routines docs](https://code.claude.com/docs/en/routines).
