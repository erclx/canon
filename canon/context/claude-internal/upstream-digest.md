---
title: Upstream digest
description: Why the Claude Code release triage runs by hand in the operator's session, why the cursor advances only after the findings are filed, and how complete a digest is
---

# Upstream digest

`internal-upstream-digest` turns the Claude Code releases published since the last run into findings filed as one intake pass. The verb contract is in `docs/agents/upstream.md`. This entry holds the reasoning behind the shape.

## Why the run is local and by hand

A scheduled cloud routine or a GitHub Actions cron was the alternative, and neither can read `.canon/`. Findings would land as GitHub issues outside the record folders, and the triage needs the repository to check each claim. A run without repository access kept a wiki item it could not verify, which is the failure that ruled it out.

The triage also does not run as a headless `claude -p` child. The auto mode classifier refused those runs during the groundwork, and an interactive run reads and writes `.canon/` like every other record. The cost is context. A month of kept lines, the catalog, and the repository reads land in the operator's own session, and the spike that measured it read 572k cache tokens over ten turns. Revisit once the first three or four digests show whether a long session pushes toward a compaction.

The skill calls `bun src/cli.ts` rather than `canon`. The global binary is the installed package, which lacks the verb until a release ships it, and the call holds only because the skill never leaves this repository.

## Why the cursor advances last

The verb never moves its own cursor. `fetch` reads and `catalog` reads, and `advance` is a separate call the skill makes after the intake pass is on disk. A run that dies between the fetch and the filing reads the same range next time, where a verb that advanced on read would skip the releases nobody triaged.

The cursor lives in its own backed record folder rather than in the intake. Intake frontmatter carries only `date`, so the range would have to be parsed back out of a folder slug a person might rename, and a reminder hook needs a value `jq` reads directly. The write goes through a temp file and a rename because the fetch and the hook read the same file.

## What the range bound does

The walk stops at the first release not newer than the cursor, not at an exact tag match. The first live run exposed why: `2.1.256`, the version the groundwork measured from, was never published as a release, so an exact match never stopped. Comparing versions bounds the range either way and still refuses when every release returned is newer than the cursor.

## How complete a digest is

Recall is incomplete. The spike that settled the class table missed three items an earlier arm found, and one run measured no variance, so the first few digests are the measurement. The skill tells the operator the result is a first pass, and the operator still reads the releases they care about.
