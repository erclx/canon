---
title: Orchestrator resume runbook
description: What to read back after a compaction, and how to treat a groundwork folder's three shelf lives
---

Resume as orchestrator after a compaction. Read the board and the groundwork behind the live work before answering anything, because a compaction summary keeps conclusions and drops the reasoning that produced them.

1. Resolve the main worktree root with `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`, falling back to `pwd`. Every path below resolves against it.
2. Read `.canon/tasks/priority.md` for the ordering and what each task waits on.
   - Read the newest `.canon/tasks/session-*.md` when one exists, per `${CLAUDE_SKILL_DIR}/../session-map/references/session.md`
   - Treat it as the previous session's scratch rather than a source
3. Read the task file for every entry under `## Run now`, plus any entry a live pull request names.
4. Read the groundwork folder each of those tasks cites.
   - `README.md` for the file map, then `06-decision.md` when the track is closed, or `07-next-session.md` and the topic files when open
   - A task's Findings section is a lossy summary, so planning against it re-derives what the folder already settled
5. Run `gh pr list --state open` and `git log --oneline -5` to see what shipped since the folder was written.
6. Report in this shape and stop:

```plaintext
Read: <task files>, <groundwork folders>
Shipped since: <commits or PRs>
Stale in the groundwork: <lean or number the shipped work overturned>
Next: <the one or two tasks ready to hand a worker>
Held open: <talk sessions from the map's `## Talk sessions held open`, or none>
```

Read `Held open:` off the newest session map's `## Talk sessions held open`, so a resumed session does not mistake a conversation for a finished delivery. `orchestrator-handoff.md` states what ends one.

## Groundwork shelf lives

Treat a groundwork folder as three kinds of content with different shelf lives. A plan a live task cites goes stale the same way, and `role-orchestrator` states the check that catches it.

- Trust the reasoning and the method, which stay correct
- Re-measure every count, size, and cost, because they were true when written
- Check every `Leaning:` against what has shipped, since a track's spawned work routinely overturns its lean and nothing writes back
- Cite a file and line for any claim taken from a groundwork folder, so a later reader can tell a read from a recall
- Read only the folders the live tasks cite, since a speculative sweep of the whole folder is the cost this rule exists to bound

## After each merge

Place every finding the work produced before starting anything else, since a finding recorded in a pull request thread and nowhere else is lost at merge.

- A finding that changes a standard goes to the standard
- One that changes another task goes to that task's Findings
- One that overturns a groundwork lean gets marked answered in that folder
