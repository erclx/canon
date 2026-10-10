---
title: Orchestrator resume runbook
description: What to read back after a compaction, and how to treat a groundwork folder's three shelf lives
---

Resume as orchestrator after a compaction. Read the board and the groundwork behind the live work before answering anything, because a compaction summary keeps conclusions and drops the reasoning that produced them.

1. Resolve the main worktree root with `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`, falling back to `pwd`. Every path below resolves against it.
2. Read `.canon/tasks/priority.md` for the ordering and what each task waits on. Read the newest `.canon/tasks/session-*.md` when one exists, per `${CLAUDE_SKILL_DIR}/../session-map/references/session.md`, and treat it as the previous session's scratch rather than a source.
3. Read the task file for every entry under `## Run now`, plus any entry a live pull request names.
4. Read the groundwork folder each of those tasks cites. Read `README.md` for the file map, then `06-decision.md` when the track is closed, or `07-next-session.md` and the numbered topic files when it is open. A task's Findings section is a lossy summary of its track, so planning against the summary re-derives what the folder already settled.
5. Run `gh pr list --state open` and `git log --oneline -5` to see what shipped since the folder was written.
6. Report in this shape and stop:

```plaintext
Read: <task files>, <groundwork folders>
Shipped since: <commits or PRs>
Stale in the groundwork: <lean or number the shipped work overturned>
Next: <the one or two tasks ready to hand a worker>
```

Treat a groundwork folder as three kinds of content with different shelf lives. Trust the reasoning and the method, which stay correct. Re-measure every count, size, and cost, because they were true when written. Check every `Leaning:` against what has shipped, because work spawned by a track routinely overturns the lean that spawned it and nothing writes back.

A plan a live task cites goes stale the same way, and `role-orchestrator` states the check that catches it.

After each merge, place every finding the work produced before starting anything else. A finding that changes a standard goes to the standard, one that changes another task goes to that task's Findings, and one that overturns a groundwork lean gets marked answered in that folder. Findings recorded in a pull request thread and nowhere else are lost at merge.

Cite a file and line for any claim taken from a groundwork folder, so a later reader can tell a read from a recall.

Do not read every groundwork folder. Read the ones the live tasks cite. A speculative sweep of the whole folder is the cost this rule exists to bound.
