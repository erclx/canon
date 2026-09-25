---
title: Orchestration
subtitle: The task, plan, and ready artifacts coordinating multi-session work, the board they sit on, and the planning, build, review, and reclaim steps that move a row to merged. Start with overview.
---

# Orchestration

The task, plan, and ready artifacts coordinating multi-session work, the board they sit on, and the planning, build, review, and reclaim steps that move a row to merged. Start with overview.

- [Board](board.md): Why the board is one orchestrator's gitignored scratch, the split between the board and the backlog, what canon tasks validate checks on a row, and where filing a row stops
- [Dispatch](dispatch.md): The self-dispatch that launches a background worker for a Run now row, its plan-answer, branch, and file-set gates, how the worker is named and addressed, and what binds concurrency
- [Overview](overview.md): The task, plan, and ready-folder artifacts coordinating multi-session work, the drafting flow that archives them on merge, and the phase label boundary
- [Planning](planning.md): The planning dispatch that launches a planner session, what it owes the tracks in flight, why the cross-feature call stays warm, and the gotchas of reading and executing a plan
- [Reclaim](reclaim.md): The reading canon worktrees list takes to decide which worktree is safe to remove after its work ships, why it refuses on an unreadable input, and the removal routes it reports
- [Review](review.md): The review trigger and its poll and watch loops, how the poll classifies a pull request and is tested, and the handback dispatch that carries a posted finding to the worker
- [Runbooks](runbooks.md): The orchestrator runbooks under role-orchestrator, the session map a compaction writes and resume reads, and the parked-row pass the sweep fires
