---
title: Orchestrator release runbook
description: How a release pull request is gated and merged, the checks after its merge, and the upgrade a repository publishing its own tooling owes before generating output
---

# Releasing

Part of `role-orchestrator`'s after-merge checklist. The session reads this file when a release pull request opens, when the operator merges one, and when a standing authorization's scope reaches one.

A release pull request is opened by a release bot, so no session owns its branch. Its sweep carries no findings, so no reviewer owes it a pass. The sections below cover before the merge, after it, and the extra checks a repository owes when it publishes the tooling its own sessions run.

## Before the merge

Merge only under an explicit grant, such as the operator's word or a standing authorization whose scope covers a release. An open release pull request otherwise holds nothing, and dispatch carries on past it.

- Confirm the release body includes the latest feature merge before the release is marked ready to merge
- A release opened before that merge carries it in the next one, so wait for the bot to refresh the pull request

### Gating a bot pull request

A release or Dependabot pull request takes no review, so its check read refuses `review-missing` forever, and a lift without `--check` returns it to draft. Never run the non-check lift on one.

- Gate its line on the `ci` entry in `gates` alone, written only when that entry reads `isOk: true`
- On a pending `ci` entry, wake through `gh pr checks <number> --watch --required` with `run_in_background`, then take a fresh `--check` read before writing the line
- On `standing-stale` with `bot: release-please`, no session owns the branch, so run `gh pr update-branch <number>`, wait for CI, and re-read the gates

## After the merge

- Confirm the tag exists and the release is published, read from the host rather than assumed from the merge record
- Read every workflow the release triggers to a pass, and report a failed one with its run link rather than treating the merge as done
- Then run the rest of the after-merge checklist, since a release merge is a merge like any other

## A repository publishing its own tooling

Run this section only when the repository publishes the CLI or the plugin its own sessions run. A repository publishing neither skips it, and the checks above stand alone.

Until the registry serves the new version, the installed tool is the old one, and an old CLI writes commands the new release retired into the prompts it generates.

- Wait for the registry to serve the new version before generating any output
- Upgrade every install this machine runs, the CLI and the plugin each, then read the version back from each before generating output
- When the release renamed or removed a skill, tell each live session to reload plugins and never to restart, since a session holding the old names stays blocked on skills that no longer resolve
- Offer to update each project consuming the tooling, and run none unasked
