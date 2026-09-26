---
name: session-resume
description: Resumes a previous session by reading the handoff it left behind, tracked work, and relevant context. Use when starting a new session, or when asked to "pick up where we left off", "what was I working on", or "resume".
---

# Session resume

## Step 1: read tracked work

Resolve `.canon/plans/`, `.canon/memory/`, `.canon/compact/`, and `.canon/tasks/` at the main worktree root the way `session-worktree` does.

Read these in parallel, skipping any that do not exist:

- the newest `.canon/compact/*.md`, then the newest `.canon/tasks/session-*.md`: the handoff a previous session wrote before a compaction. The first is the note `session-compact` writes, and the second is the board-side map per `${CLAUDE_SKILL_DIR}/../../standards/session.md`, which stays readable. Whichever exists leads the report rather than the reads, and both lead it when both exist.
- `.canon/tasks/index.md`: the folder catalog. Read this before any individual task file, and take the task list from it by dropping the `index`, `priority`, `backlog`, and `session-` rows, which are siblings rather than tasks.
- `.canon/plans/*.md`: execution detail for in-progress tasks

Then read only the task files the summary needs, typically the top one. Do not read the whole folder.

Once the top task is known, grep `.canon/memory/index.md` for two or three terms from its title and read at most three of the entries whose rows match. Never read the index whole, since a grown pen's index runs to hundreds of rows and the report shows three at most. With no top task, or no row matching, read no memory entry and say nothing about it.

Most projects carry no handoff. Say nothing about its absence, since a line reporting it every run trains a reader to skip the line on the run where a handoff exists.

If the handoff, task, and plan surfaces are all absent or empty, stop: `✅ No tracked work found. Start a new task.`

## Step 2: summarize

Output these sections, omitting the first when no handoff was found:

**Carried over:** the reasoning the handoff holds, as its writer stated it. Attribute it to the map rather than restating it as fact, and re-measure any count, size, or cost before acting on one.

**Up next:** one line per task row in `.canon/tasks/index.md`, preserving order. A board carrying handoffs has a row per session that wrote one, so a report listing every row queues work nobody filed.

**Active plans:** one line per file in `.canon/plans/`, linking each to its task file in `.canon/tasks/`. Say "None" if empty.

**Relevant context:** the memory entries Step 1 matched to the top backlog item, three at most. Skip if none matched.

## Step 3: recommend

End with one line: `Start with: <first Up next item>` and note whether it has a linked plan.

When the board is empty and a handoff was found, name what the handoff leaves open instead: `Start with: <the open thread the handoff names>`. A recommendation slot filled with nothing reads as a failed run, and a handoff on an empty board is the shape a session leaves when it was reasoning rather than shipping.

Do not offer to remove entries. A completed task is archived out of `.canon/tasks/` when work ships. The git log is the authoritative record of shipped work. Plan files are archived per the lifecycle rule in `${CLAUDE_SKILL_DIR}/../../standards/plan.md`.

Memory is updated only when a recorded fact becomes wrong, never on resume. A domain fact reaches a session through `canon/context/`, which `memory-capture` routes to and the three-tier model loads on demand, so the memory folder read here is the residue no context entry owns.

## Writing the next one

This skill reads a handoff and never writes one. Reading and writing are two jobs, and the write happens at the close of a session rather than at its start.

Route a session asking how to leave a handoff behind to `session-compact`, which writes a note under `.canon/compact/`. A session holding the orchestrator role takes `session-map` instead, which writes the board-side map the standard governs, and a role carrying sections of its own adds them over the core per that role's own runbook.
