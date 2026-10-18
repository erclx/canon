---
name: session-map
description: Why the write procedure needs a board-side route for the orchestrator and for a request naming the map, why the door carries the drift step and its ref recovery, and why it states none of the shape the standard already fixes
---

# Session map requirement

## Gap

Without this skill, the standard for the board-side handoff carries a full write procedure and nothing routes a session to it, though the resume path reads the newest map first. The only other routed writer is the orchestrator role, which hands a plain session a section it cannot fill.

The drift step reads a start commit nothing on the machine records, so naming the step without its recovery ships an instruction nobody can follow. Where the step's surface is missing, a session skips it as having nothing to act on and leaves a map that looks conforming. A body restating the standard drifts from it.

## Must

- An orchestrating session, or a request naming the session map or the board, reaches the write without the skill asserting a role the session does not hold
- The filename, frontmatter, sections, numbered steps, and citation rule come from the standard by citation, never restated
- The drift step runs, its start ref is recovered from how long the session has run, and what the verb names or refuses is recorded as the boundary of what it read
- The file lands whole at the main worktree root, through the shell where the editing tools refuse that root, under the branchless filename when the slug is empty
- Model invocation stays enabled, so a session that has dropped its routing still reaches the write by description

## Must not

- Skip a step by predicting what its skill or verb would have answered, rather than running it and recording what came back
- Add a role's section to a map written by a session holding no such role
- Take the worktree-local copy the editing tools offer in place of the main-root path
- Summarize the board, the task files, or the shipped work, each of which survives a compaction on its own
- Write a map outside a git repository, since the filename comes from the branch

## Out of scope

- The note a plain session writes before a compaction, outside the board and with no drift step, which `session-compact` owns
- Reading a handoff back at the start of the next session, which `session-resume` owns
- The orchestrator's sections over the core three, which `role-orchestrator` owns
