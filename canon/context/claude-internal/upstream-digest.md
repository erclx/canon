---
title: Upstream digest
description: Why the Claude Code release triage runs by hand in the operator's session, why the cursor advances only after the findings are filed, and how complete a digest is
---

# Upstream digest

`internal-upstream-digest` turns the Claude Code releases published since the last run into findings filed as one intake pass. The verb contract is in `canon upstream --help`. This entry holds the reasoning behind the shape.

## Decisions

### Why the run is local and by hand

A scheduled cloud routine or a GitHub Actions cron cannot read `.canon/`. Findings would land as GitHub issues outside the record folders, and the triage needs the repository to check each claim. A run without repository access kept a wiki item it could not verify.

- The triage does not run as a headless `claude -p` child, because the auto mode classifier refused those runs during the groundwork
- An interactive run costs context. The month's lines, the catalog, and the repository reads land in the operator's session, 572k cache tokens in the spike. Revisit after three or four digests.
- The skill calls `bun src/cli.ts` rather than `canon`, since the global binary lacks the verb until a release ships it. That holds only because the skill never leaves this repository.

### Why the cursor advances last

The verb never moves its own cursor. `fetch` and `catalog` read, and `advance` is a separate call the skill makes after the intake pass is on disk. A run that dies between the fetch and the filing reads the same range next time, where a verb that advanced on read would skip releases nobody triaged.

The cursor lives in its own backed record folder. Intake frontmatter carries only `date`, so the range would have to be parsed from a folder slug a person might rename. The write goes through a temp file and a rename because the fetch and the due check read the same file.

### What the range bound does

The walk stops at the first release not newer than the cursor, not at an exact tag match. `2.1.256`, the version the groundwork measured from, was never published as a release, so an exact match never stopped.

- Comparing versions bounds the range either way and still refuses when every release returned is newer than the cursor
- GitHub lists releases by creation date, so a backport published after a newer version would end the walk early. The current feed has none.

### Why the reminder is quiet by default

The run is by hand, so something has to say when it is due. A `SessionStart` hook calls `upstream due` and prints one line, and three choices keep it cheap.

- **It goes to the operator, not the model.** The line leaves through `systemMessage`, since hook stdout would spend a transcript line per session and invite an unrequested digest.
- **It skips background sessions.** A wave starts about twenty and unauthenticated requests cap at 60 an hour. The filter reads `CLAUDE_CODE_SESSION_ATTENDED` as `0`, like `unattended-agent-guard.sh`.
- **It reads the feed once a day.** The reading is cached under the scratch folder, since a records push backs the upstream folder and a daily rewrite would add a commit. A failed read is cached too.

The `0` value is undocumented. If an interactive terminal also read `0` the reminder would go silent, which fails safe.

A cursor exactly seven days old is due. An install at or below the cursor is never due, which covers a downgrade and a session right after a digest.

### How complete a digest is

Recall is incomplete. The spike that settled the class table missed three items an earlier arm found, and one run measured no variance, so the first few digests are the measurement. The skill tells the operator the result is a first pass, and the operator still reads the releases they care about.
