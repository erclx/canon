---
name: session-map
description: Why the write procedure needs a board-side route for the orchestrator and for a request naming the map, why the door carries the drift step and its ref recovery, and why it states none of the shape the standard already fixes
---

# Session map requirement

## Gap

Without this skill, the standard governing the pre-compaction handoff carries a complete numbered write procedure and nothing routes a session to it. The reading half already works, since the resume path opens the newest map and leads its report with it, so a file nobody is routed to write is read by a surface built to find it.

The only routed writer belongs to the orchestrator role. It disables model invocation, asserts that role on invocation, and adds a section for decisions taken under delegated authority, so a plain feature session that reaches it receives a section it cannot fill and a review poll it does not run.

The drift step is the one most specific to session length and the easiest to skip. It reads the commit the session started from, nothing on the machine records that commit, and a route that names the step without naming how to recover the ref ships an instruction nobody can follow.

A step that reads a surface a project may not carry gets skipped on the reasoning that it has nothing to act on. A cold session run against a project with no `.claude/` tree skipped the drift step and wrote its own rationale into the map, so the step the route exists to carry did not run on the first test from outside. The skip is worst where it looks most defensible, and a session that takes it quietly leaves a map indistinguishable from a conforming one.

A body that restates the sections, the frontmatter, or the numbered steps becomes a second source that drifts from the standard, which is the failure the split between the role writer and the core was made to remove rather than move.

## Must

- Write for an orchestrating session, or on a request naming the session map or the board, without asserting a role the session does not hold
- Cite the standard for the filename, the frontmatter, the sections, the numbered procedure, and the citation rule rather than restating any of them
- Run the drift step and state how to recover the ref it reads from how long the session has run
- Record what the drift verb names, and read a refusal as the boundary of what the verb can read
- Resolve the folder at the main worktree root, and write the file whole from the shell where the editing tools refuse that root
- Fall back to the branchless filename on an empty slug rather than stopping
- Leave model invocation enabled, so a session that has dropped its routing still reaches this by description

## Must not

- Restate the standard's sections, frontmatter, or numbered steps
- Skip a step by predicting what its skill or verb would have answered, rather than running it and recording what came back
- Assert a role, or add a role's section to a map written by a session holding no such role
- Take the worktree-local copy the editing tools offer in place of the main-root path
- Summarize the board, the task files, or the work that shipped, each of which is carried by an artifact a compaction leaves standing

## Guards

- Not a git repository: stop, since the filename comes from the branch
- Empty slug: fall back rather than stop, since the reasoning is worth more than the name
- The drift verb refusing: record the boundary under standing cautions and keep writing

## Out of scope

- The handoff a plain session writes before a compaction, which is a note outside the board with no drift step and no `## State`: `session-compact`. Both skills once claimed the phrases "write the handoff" and "about to compact", so this description narrows to the orchestrator and to a request naming the map or the board, and a plain session belongs to `session-compact`.
- Reading a handoff back at the start of the next session: `session-resume`
- The sections a role adds over the core three, which belong to that role's own surface. `role-orchestrator` owns the orchestrator's and cites this route for the generic half.
- Validating a written map against the standard, which no record kind covers, so a conforming shape rests on the standard being followed
- Firing the write without being asked, which is a question about what the harness supports and is measured on its own track
