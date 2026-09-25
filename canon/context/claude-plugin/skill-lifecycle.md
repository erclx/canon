---
title: Skill lifecycle
description: How a skill is invoked, the split between the two task-board writers, where a session fact is routed, the plan archive that rides on the task archive, and the sandbox arm that covers it
---

# Skill lifecycle

## Invocation

Invoke with `/skill-name` or let Claude auto-trigger by matching against the skill description. Skills marked with `disable-model-invocation: true` require explicit invocation and will not auto-trigger. Git skills (`git-commit`, `git-pr`, `git-branch`, `git-stage`) override built-in commit and PR behavior. See `standards/skill.md` for authoring conventions.

That flag blocks the `Skill` tool rather than only suppressing an auto-trigger, which decides who can delegate to a flagged body. A slash command inside a `claude --bg` launch prompt reaches a flagged body as an expanded invocation, which is what every dispatch here relies on: `auto-ship` carries the flag and is launched as `/canon:auto-ship`. A session acting on an inbound message does not reach it this way, because a message reaches a skill through the `Skill` tool and through no other route, so a chain step invoking a flagged sibling through the tool meets the flag rather than the body. The answer through that route has been measured inconsistent rather than a deterministic refusal, which is why the fallback below matters: a caller cannot rely on the call succeeding even when the flag is the only thing in its way.

A slash command expands as a user invocation only at position zero of a prompt. A command chained after a first one in the same text reaches the session as prose instead, with the `Skill` tool as its only remaining route, which the flag then refuses. Position zero is necessary and not sufficient: the delimiter after the command token also matters, and a command glued to a comma rather than followed by a space has been observed not to expand even at position zero.

A refusal names the flag in its own message and closes the fallback there, so a refused caller correctly has no route left and stops rather than degrading. It repeats identically on a retry inside the same session.

Prefer pointing a chain step at an unflagged body that already performs the step over dropping the flag from the callee, since dropping a flag reopens a body to description matching its author closed on purpose. `claude/skills/role-orchestrator/references/orchestrator-dispatch.md` carries the launch-prompt form a dispatcher writes, keeping a chain to one leading slash command per launch and handing the rest to the tool.

A harness hook is a third route to a skill, and `session-compact` is the only one reached this way: a `PreCompact` hook names it in the reason it blocks a manual compaction with, covered in `canon/context/development/hooks/compaction.md`. A skill named by a hook is named in a string nothing validates, so a rename here leaves the hook pointing at a skill that no longer answers, with no stage comparing the two.

## A held body is checked against history

A session loads a skill body once and keeps it, so an edit made this session is not picked up, and a compaction carries the held copy forward. A held body naming a file the branch deleted fails loudly, while one naming a file that still exists and says something different reads current, so the session applies the superseded rule and reports success. That is the ordinary ship shape here, since a branch touching `docs-fold`, `git-stage`, or `git-pr` runs those skills later in the chain that edited them.

`canon claude skills drift <ref>` names which shipped bodies moved between a ref and `HEAD`, and `standards/session.md` runs it while a session map is written. Comparing the bytes a session holds cannot be built, since a session cannot read its own loaded body back, so the substitute reports a file moving rather than a held copy differing. `governance/rules/claude/570-skill.md` carries the instruction on the body being edited, since telling a session to re-invoke the skill fixes nothing and a re-read step in the ship chain was declined on cost. Measured at `34ce48e6` on 2026-08-20.

## The diagram folder

`.canon/diagrams/` holds an entry per kind under a fixed filename, chosen over a single `DIAGRAMS.md`. The kinds drift at rates spanning roughly an order of magnitude, so a deploy change rewrites one entry and leaves the others untouched, and fixed filenames are what let a session refreshing a kind find the file it is meant to overwrite rather than writing a second one beside it. A kind carrying a second question takes a suffixed name and repeats its category, which is how the folder reaches nine entries across five kinds.

## The task board split

Two skills write to the task board and the split is by operation rather than by file. `task-board` brings a task file into existence and moves a shipped one to `.canon/tasks/archive/`. `docs-fold` edits the contents of a file that already exists, marking outcomes `[x]` from the diff and sweeping the plans those tasks cite. Neither crosses into the other, because two skills relocating the same file drift into relocating it differently.

Creation is the only moment the task-origin invariant is enforceable, so that is where `task-board` enforces it. A task names a plan, a groundwork folder, an intake folder, or an issue, and the skill refuses to write one that names none. The reverse direction is a report rather than a prompt, since a groundwork track can be opened long after its task would have been written, and an offer to create a task for each open track would be noise on most runs.

That set lives in `standards/tasks.md` and is restated in three places, so extending it costs four edits rather than one. `task-board` enumerates which keys take the markdown-link form and which stay a bare number, `git-pr` names the origin lines it anchors `Pull request:` under, and `docs/workflow/ai-workflow.md` states the invariant for a consumer. None reads the standard at runtime, so a key added to the standard alone leaves all three narrowing a set they no longer match.

Archiving a task archives its plan with it, inside `archiveTask` rather than in a call beside it. Archiving driven by a merge rather than by a person is a third path, covered in `canon/context/claude-plugin/skill-archiving.md`, and it is what fixes the placement: the `post-merge` hook reaches the archive with nobody watching, so a second call is a second failure point that leaves the task archived and the plan live.

The two halves close in one act, so neither can run before the other and no caller is sent elsewhere first.

## Where a session fact lands

A fact a session learns is routed by owner rather than filed in one place. `memory-capture` classifies each candidate, and a project fact whose subject names an entry in `canon/context/index.md` goes to that entry, which the three-tier model already loads on demand. Everything else stays a memory file. The test is a named catalog entry rather than a judgment about fit, so it fails closed to memory when no entry matches or when two do.

Capture never edits a context entry. It appends the fact to `.canon/tmp/handoff/memory-routing/<slug>.md` and `docs-fold` folds it in, which keeps one skill writing those files. The handoff is a file rather than a spoken result so it survives a compaction between the two steps, and so a standalone capture leaves something a later `/docs-fold` consumes.

A second producer hands off through a file of its own rather than sharing this one. `teach-workspace` writes each confirmed promotion to `.canon/tmp/handoff/teach-promotion/<slug>.md`, which `docs-fold` folds and deletes. Sharing the memory-routing file was the obvious reuse and the one the pattern cannot take, since that file already has a writer and a reader that deletes it, so a fold triggered by one producer would discard whatever the other wrote and never read. The fold reaching the public docs corpus is the cost, since `docs-sync` owns that tree, and the carve-out is landing a page whose destination an operator already confirmed. Splitting the fold across two skills by destination was declined, since it puts one handoff file under two readers. Measured at `f0f8bd62` on 2026-08-19.

A routing file written under the `latest` slug can collect facts for several domains and several sessions, so the branch consuming it owns only part of what it holds. A fold therefore takes one section at a time and deletes the file once no section is left, since folding it whole pulls an unrelated domain into the diff and deleting it whole discards a fact nobody read.

Capture leads the sequence in `git-ship`, the one body stating it.

`role-orchestrator` fires capture from its pre-compact handoff runbook, which reaches it through `session-map`, the board-side handoff the orchestrator keeps while a plain session takes `session-compact`, and states the session does not commit so routing is skipped. Both other callers ship and this session never does, so without that step the session taking every operator correction records none. The refill sweep reports the debt instead of paying it, because a capture per batch of merges bills the operator a wait while nothing is being built. What this session produces is feedback about how to work.

The pen is bounded by that ownership test rather than by a memory's type, so the four types are equal members of the residue no entry owns. Reading all 145 `project`-typed entries against the domain catalog put 98 with a domain entry, 44 with no owner at all, and 3 already promoted elsewhere. Narrowing the pen to feedback about how to work was the alternative and it lost on the middle number, since the 44 state approaches governing how the agent works that no entry owns, which is why `standards/memory.md` admits `project` as a first-class type. Measured at `c7e92612` on 2026-08-20, at 98 entries retired into an archive then holding 100.

An entry leaving the pen is archived to `.canon/memory/archive/` rather than deleted, and `.canon/memory/index.md` is generated by a hook rather than appended by hand. The archive sits inside the pen itself, backed the same as every other memory entry, even though nothing cites a retired one the way a task file cites a plan.

## The plan archive

Every stop the verb emits has to name a next step that actually moves. The archive is gated on the citing task's outcomes being all `[x]`, and a stop that routes past that gate returns the caller to the same guard unchanged. The citation count is not a gate at all: it decides whether the plan travels, and the task archives either way.

A plan that ships is archived rather than removed. `archiveTask` moves it from `.canon/plans/` to `.canon/plans/archive/`, then writes the task file's `Plan:` line at the new location as it lands in `.canon/tasks/archive/`, a folder deeper than the live pair. Retargeting is what makes the archive worth having, since an archive nothing points at is barely better than a deletion. A task already pointing into the archive moves on its own with nothing to carry, which keeps a second pass idempotent instead of acting on work it did itself.

### Reading the plan citation

The `Plan:` line carries a markdown link relative to `.canon/tasks/`, so both parsers read the target out of the parentheses and both resolve it against that folder before routing on it. Resolving is what lets `../plans/x.md` and the older bare `.canon/plans/x.md` land on the same file, and skipping it would drop every link-form task through to the sweep's final warn-and-skip branch, archiving nothing. The retarget writes a link back for the same reason it reads one: that branch is the only writer producing a `Plan:` line nobody authored, so emitting a bare path would convert the board to the old form one closing task at a time.

The plan travels only when the closing task is its last live citation. One plan can serve several tasks, and moving it on the first to close strands every other pointer at a path that no longer resolves. `.canon/plans/` is gitignored, so no history recovers the retarget and the shared plan stays put until the last citation closes.

The count compares the resolved target rather than the raw string, because a board holding one task written `../plans/x.md` and another written `.canon/plans/x.md` cites one plan and a raw comparison reads two, counts zero, and archives the file out from under a live task. Comparing basenames instead trades that for the mirror error, since a live plan and an archived one share a filename whenever a closed task still points into `.canon/plans/archive/`, so the count invents a citation and the plan is never archived.

### Scope placement in an instruction step

A step's scope belongs in the sentence carrying the instruction rather than in a correction stated below it, since a scope stated as a correction loses to the instruction above it. A step opening with one scope and asserting a wider one several lines later reads as the narrower scope regardless of what the correction says.

## The board-sweep sandbox arm

The sandbox arm for this is `board-sweep`, kept separate from `drift`. Both assert that a run marking outcomes moves no plan, `drift` for the task its prompt names and `board-sweep` for one the prompt never mentions, so a failure stays unambiguous between the two readings a session could take.

The arm carries a third task whose outcomes stay open and whose plan must survive the run. It is what separates a run that moved nothing from one that moved everything, since a fixture where every plan stays live reads the same under both until a task the run had no reason to touch is standing beside them. Its assertions cover each plan's location and each task's untouched `Plan:` line, since a run that retargeted a pointer without moving the file would leave the task aimed at an archive path holding nothing.

## Merging one skill into another absorbs the body

Merging one skill into another moves the body, not only the description. The survivor gains the absorbed behavior as a state-selected branch and the pointer left at the old name carries `disable-model-invocation: true` so it stops competing for routing. `design-extract` is the worked case: it absorbed a sibling proposing token values for a project with no code, while its own path sources them from code and leaves a cell blank when nothing anchors it, so absorbing the triggers alone would route every greenfield caller to a body returning blanks. Where two bodies disagree rather than duplicate, the survivor branches on project state and never on a flag. Check also whether the absorbed skill's sandbox scenario can rename to the survivor, since the survivor's filename may already be taken.
