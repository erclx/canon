---
title: Skill lifecycle
description: How a skill is invoked, the three task-board writers, where a session fact is routed, and the plan archive on the task archive
---

# Skill lifecycle

## Overview

How a skill is invoked, the three task-board writers, where a session fact is routed, and the plan archive on the task archive.

## Layout

### Routes to a skill

Invoke a skill with `/skill-name` or let Claude auto-trigger it by matching the description. A skill marked `disable-model-invocation: true` requires explicit invocation. Git skills (`git-commit`, `git-pr`, `git-branch`, `git-stage`) override built-in commit and PR behavior. Conventions are in `claude/skills/create-skill/references/skill.md`.

- A slash command in a `claude --bg` launch prompt reaches a flagged body as an expanded invocation, which every dispatch relies on. `auto-ship` carries the flag and launches as `/canon:auto-ship`.
- A harness hook is a third route, and only `session-compact` is reached so. A `PreCompact` hook names it when blocking a manual compaction, per `canon/context/development/hooks/compaction.md`.
- A skill named by a hook is named in a string nothing validates, so a rename leaves the hook pointing at a skill that no longer answers, and no stage compares the two

### The mark sandbox arm

The sandbox arm for this is `task-complete`'s `mark`, kept separate from the fold's `drift`. `mark` asserts that a run marking outcomes moves no plan for a task the prompt never mentions, and `drift` asserts the fold leaves plans and the board alone.

- The arm carries a third task with open outcomes whose plan must survive the run. It separates a run that moved nothing from one that moved everything, which a fixture with every plan live cannot.
- Its assertions cover each plan's location and each task's untouched `Plan:` line, since a retargeted pointer with an unmoved file leaves the task aimed at an empty archive path

### A pointer is still a shipped skill

A pointer counts as a shipped skill for both coverage checks, since `canon claude skills list --names` reports every folder whether or not its body carries `disable-model-invocation: true`.

- It needs a routing case in `src/claude/cases/` and a `metadata.family` naming its row's group
- It needs a row in the skills table of `docs/workflow/skill-map.md`, or of `docs/workflow/skill-map-on-request.md` for a skill serving a request
- Each spelling of the old name there takes a `canon-keep-retired` marker, so a later sweep does not move it onto the survivor

## Decisions

### A held body is checked against history

A session loads a skill body once and keeps it, so a mid-session edit is not picked up, and a compaction carries the held copy forward. A held body naming a deleted file fails loudly, while one naming a file that now says something different reads current. The session applies the superseded rule and reports success.

That is the ordinary ship shape here, since a branch touching `context-fold`, `git-stage`, or `git-pr` runs those skills later in the chain that edited them.

- `canon claude skills drift <ref>` names which shipped bodies moved between a ref and `HEAD`, and `claude/skills/session-map/references/session.md` runs it while a session map is written
- Comparing held bytes cannot be built, since a session cannot read its own loaded body back, so the substitute reports a file moving rather than a held copy differing
- `governance/rules/claude/skill.md` carries the instruction on the edited body, since telling a session to re-invoke the skill fixes nothing. A re-read step in the ship chain was declined on cost.

Measured at `34ce48e6` on 2026-08-20.

### Diagrams as figures

The architecture views are one reference inside `draft-figure` rather than a skill writing a `.canon/diagrams/` folder of per-kind entries. The folder skill had no recorded use, and its per-kind filenames, `verified` marker, and regenerated catalog served only the folder.

A view now lands in a document the user names and goes through the same Mermaid render and read-back as every other figure. The cost is the staleness signal, since nothing records the commit a view was checked against. The record-root lists still back up and audit a `.canon/diagrams/` an older install left.

### The task board split

Three writers touch the task board, split by operation rather than by file. None crosses into another, because two skills relocating the same file drift into relocating it differently.

- `task-board` brings a task file into existence and declines one
- `task-complete` edits the contents of an existing file, marking outcomes `[x]` from the diff, and archives a shipped one by hand
- The `post-merge` hook archives the task a merge closed through the same `canon tasks archive` call

Marking left `context-fold` for a skill of its own. The fold ran ten steps on every ship, so a session asking for the context entries got the board, the receipts, and the design record too, and could not tell which step it had asked for.

Archiving at ship time was rejected for the new skill's chain step, since the pull request has not merged there and a task archived early is lost if abandoned. The chain marks and the hook archives.

### Task origin

Creation is the only moment the task-origin invariant is enforceable, so `task-board` enforces it there. A task names a plan, a groundwork folder, an intake folder, or an issue, and the skill refuses to write one that names none.

- The reverse direction is a report rather than a prompt, since a groundwork track can open long after its task would have been written and an offer per open track would be noise
- The set lives in `claude/skills/task-board/references/tasks.md` and is restated in three places, so extending it costs four edits
- `task-board` enumerates which keys take the markdown-link form and which stay a bare number, and `git-pr` names the origin lines it anchors `Pull request:` under
- `docs/workflow/parallel-features.md` states the invariant for a consumer. None of the three reads the standard at runtime, so a key added to the standard alone leaves them narrowing a stale set.

### Where a session fact lands

A fact a session learns reaches the context entry that owns it through `context-fold`, which reads the diff, rather than through a capture step. The toolkit once ran `memory-capture` on every ship and retired it. Nothing loaded its gitignored folder into a later session, and Claude Code keeps a memory of its own.

The cost the operator accepted is that a lesson no context entry owns has no home outside a task's Findings or the platform memory.

- A producer handing a page on does so through a file of its own. `teach-workspace` writes each confirmed promotion to `.canon/tmp/handoff/teach-promotion/<slug>.md`.
- Its own fold mode lands each page from a branch and deletes the file, since the file is that skill's output and the consumer sits with its producer
- Leaving the landing in `context-fold` lost when the fold was cut to context entries alone, which would have stranded every confirmed promotion in scratch
- `role-orchestrator` sends a lesson about how to work to the owning task's Findings from its handoff runbook, because the session commits nothing and a domain fact belongs to the task owning it

### Archiving rides on the task

A plan that ships is archived rather than removed, inside `archiveTask` rather than in a call beside it. The `post-merge` hook reaches the archive with nobody watching, so a second call is a second failure point that leaves the task archived and the plan live. Merge-driven archiving is covered in `canon/context/claude-plugin/skill-archiving.md`.

- `archiveTask` moves the plan to `.canon/plans/archive/`, then rewrites the task's `Plan:` line for its new home in `.canon/tasks/archive/`, a folder deeper than the live pair
- Retargeting is what makes the archive worth having, since an archive nothing points at is barely better than a deletion
- A task already pointing into the archive moves on its own with nothing to carry, so a second pass is idempotent
- The two halves close in one act, so neither runs before the other and no caller is sent elsewhere first

Every stop the verb emits has to name a next step that moves. The archive is gated on the citing task's outcomes all being `[x]`, and a stop routing past that gate returns the caller to the same guard. The citation count is no gate. It decides whether the plan travels, and the task archives either way.

### Merging one skill into another absorbs the body

A merge moves the body, not only the description. The survivor gains the absorbed behavior as a state-selected branch, and the pointer left at the old name carries `disable-model-invocation: true` so it stops competing for routing.

- The design extraction skill was the worked case. It absorbed a sibling proposing token values for a project with no code, while its own path left a cell blank when no code anchored it.
- Absorbing the triggers alone would have routed every greenfield caller to a body returning blanks
- Where two bodies disagree rather than duplicate, the survivor branches on project state and never on a flag
- Check whether the absorbed skill's sandbox scenario can rename to the survivor, since the survivor's filename may be taken

### A rename leaves a pointer

A plain rename leaves the same pointer, since a typed invocation of the old name and a target not yet swept both still reach for it. The body moves through `canon migrate skill-names` with a row in its map. `context-fold` is the worked case, and the pointer retires on a measured test its own requirement states rather than on a release number.

- The pointer's two paths join the map's `excludedPaths` only after the sweep has run
- Excluding them first leaves the real body unmoved at the old path while every citation names the new one, and leaving them out afterwards lets a later run move the pointer onto the survivor

## Gotchas

### The flag blocks the `Skill` tool

The flag blocks the `Skill` tool rather than only suppressing an auto-trigger, which decides who can delegate to a flagged body. A message reaches a skill through the `Skill` tool and no other route, so a chain step invoking a flagged sibling through the tool meets the flag rather than the body.

- The answer through that route has been measured inconsistent rather than a deterministic refusal, so a caller cannot rely on the call succeeding
- A refusal names the flag in its own message and repeats identically on a retry in the same session, so a refused caller has no route left and stops rather than degrading
- Prefer pointing a chain step at an unflagged body that already performs the step. Dropping the flag from the callee reopens a body to description matching that its author closed on purpose.

### Position zero

A slash command expands as a user invocation only at position zero of a prompt. A command chained after a first one reaches the session as prose, with the `Skill` tool as its only remaining route, which the flag then refuses.

- Position zero is necessary and not sufficient, since a command glued to a comma rather than followed by a space has been observed not to expand even there
- `claude/skills/role-orchestrator/references/orchestrator-launch.md` carries the launch-prompt form a dispatcher writes, one leading slash command per launch with the rest handed to the tool

### Reading the plan citation

The `Plan:` line carries a markdown link relative to `.canon/tasks/`, so both parsers read the target out of the parentheses and resolve it against that folder before routing on it. Resolving lets `../plans/x.md` and the older bare `.canon/plans/x.md` land on the same file.

- Skipping the resolve would drop every link-form task through to the sweep's final warn-and-skip branch, archiving nothing
- The retarget writes a link back too. That branch is the only writer of a `Plan:` line nobody authored, and a bare path would convert the board to the old form one task at a time.

### The last live citation

The plan travels only when the closing task is its last live citation. One plan can serve several tasks, and moving it on the first to close strands every other pointer. `.canon/plans/` is gitignored, so no history recovers the retarget.

- The count compares the resolved target. Tasks written `../plans/x.md` and `.canon/plans/x.md` cite one plan, and a raw string comparison counts zero and archives the file from under a live task.
- Comparing basenames trades that for the mirror error. A live plan and an archived one share a filename when a closed task points into `.canon/plans/archive/`, so the count invents a citation.

### Scope placement in an instruction step

A step's scope belongs in the sentence carrying the instruction rather than in a correction below it, since a scope stated as a correction loses to the instruction above it. A step opening with one scope and asserting a wider one several lines later reads as the narrower scope.
