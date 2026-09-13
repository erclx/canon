---
title: Skill lifecycle
description: How a skill is invoked, the split between the two task-board writers, where a session fact is routed, the plan archive that rides on the task archive, and the sandbox arm that covers it
---

# Skill lifecycle

## Invocation

Invoke with `/skill-name` or let Claude auto-trigger by matching against the skill description. Skills marked with `disable-model-invocation: true` require explicit invocation and will not auto-trigger. Git skills (`git-commit`, `git-pr`, `git-branch`, `git-stage`) override built-in commit and PR behavior. See `standards/skill.md` for authoring conventions.

That flag blocks the `Skill` tool rather than only suppressing an auto-trigger, which decides who can delegate to a flagged body and reads as a nicety until a chain meets it. A slash command inside a `claude --bg` launch prompt reaches one, and every dispatch here relies on that, since `auto-ship` carries the flag and is launched as `/canon:auto-ship`. A session acting on an inbound message does not, because a message reaches a skill through the tool and through no other route.

The distinction has cost two chains and only the first reached production. `auto-ship` Step 7 said to invoke `git-ship`, which carried the flag, and every chained run halted with the branch built and uncommitted until `#1247` removed it. That pull request recorded the gap it left open, being that a future delegation to another flagged body would fail the same way and pass every gate before it. `canon-rollout` was that delegation: its Phase 3 told an orchestrator to message a live worker and name `canon-rollout` itself, which would have broken the address leg on its most common branch. Review caught it before the merge, so the pattern is written here rather than met a third time.

The flat form of that claim did not hold on 2026-08-31, and the answer is inconsistent rather than the other way round. Four sessions made the same tool call against the same plugin cache that day. Two were answered with the body and ran the whole chain, and two were refused with `Skill canon:auto-ship cannot be used with Skill tool due to disable-model-invocation`. Prefixing separated nothing, since three of the four carried the namespace and those three landed on both answers. The refusal is also sticky inside a session, since one refused caller repeated the identical call and got the byte-identical error back.

Two facts survive that. The refusal closes the fallback in the same message, telling the session not to replicate the workflow by other means, so a refused caller correctly has no route left and stops rather than degrading. And a launch prompt expands its leading slash command alone, so a chain needing two user invocations gets one and hands the rest to the tool. `claude/skills/role-orchestrator/references/orchestrator-dispatch.md` carries both where a dispatcher writes a prompt, along with the untested launch shape that would close it.

The repair shape differs by which route the caller has. `#1247` dropped the flag because the caller was a chain step inside one session. `canon-rollout` kept its flag and renamed the callee instead, pointing the handback at `review-address`, which carries none. Prefer the rename where an unflagged body already performs the step, since dropping a flag opens a body to description matching that its author closed on purpose.

A dispatch run on 2026-09-02 tried the untested candidate above: a launch prompt leading with `/canon:auto-ship <plan>`, carrying only a conditional fallback naming `session-worktree` for a worktree already in place. The worker's own report, read from inside the session it launched, said the launch reached the flagged body as an expanded user invocation in a `<command-message>` block rather than through the `Skill` tool, so no refusal was ever in play there, and that chain's own Step 0 entered the worktree through the unflagged `session-worktree`, so the fallback never fired either. One success does not settle the flag's inconsistency, because this run never exercised the `Skill` tool route the flag gates, and the flag's answer through the `Skill` tool is already measured as inconsistent rather than as a hard failure. Read this as one further data point on the position-zero expansion mechanism rather than as proof it closes the disable-model-invocation inconsistency.

A second dispatch the same day met the inverse case and explains rather than only extends it. That launch led with `/canon:session-worktree <name>` and chained a second command, `/canon:auto-ship <plan>`, later in the same prompt. The leading command took position zero and ran as an invocation, and the second reached the session as prose, so the `Skill` tool call it fell back to was refused.

A peer session reporting on the same day named a partial cause: a slash command expands as a user invocation only at position zero of a prompt, so a later one in the same text, chained after a first, reaches the session as prose with the `Skill` tool as its only remaining route, which the flag then refuses.

Position zero is necessary and not sufficient. Five launches from the same dispatching session that day opened `/canon:role-planner, then /canon:plan-feature <task>`, a slash command at position zero, and none expanded. One of those sessions reported that from inside its own launch, the only vantage that can read it, naming the two `Skill` tool calls it made instead of an invocation. The one difference from the confirmed expansion is the delimiter after the command token, a comma glued to the name against a space before an argument, which leaves the delimiter as the open variable rather than the question this paragraph closes.

A harness hook is the third route and `session-map` is the only skill reached by one. A `PreCompact` hook names it in the reason it blocks a manual compaction with, which `canon/context/development/hooks.md` covers. What separates that route from the two above is that a skill named by a hook is named in a string nothing validates, so a rename here leaves the hook pointing at a skill that no longer answers and no stage compares the two.

## The task board split

Two skills write to the task board and the split is by operation rather than by file. `task-board` brings a task file into existence and moves a shipped one to `.canon/tasks/archive/`. `docs-fold` edits the contents of a file that already exists, marking outcomes `[x]` from the diff and sweeping the plans those tasks cite. Neither crosses into the other, because two skills relocating the same file drift into relocating it differently.

Creation is the only moment the task-origin invariant is enforceable, so that is where `task-board` enforces it. A task names a plan, a groundwork folder, an intake folder, or an issue, and the skill refuses to write one that names none. The reverse direction is a report rather than a prompt, since a groundwork track can be opened long after its task would have been written, and an offer to create a task for each open track would be noise on most runs.

That set lives in `standards/tasks.md` and is restated in three places, so extending it costs four edits rather than one. `task-board` enumerates which keys take the markdown-link form and which stay a bare number, `git-pr` names the origin lines it anchors `Pull request:` under, and `docs/workflow/ai-workflow.md` states the invariant for a consumer. None reads the standard at runtime, so a key added to the standard alone leaves all three narrowing a set they no longer match. The `Intake:` addition reached review with exactly that trio stale behind it, which is where the count comes from.

Archiving a task archives its plan with it, inside `archiveTask` rather than in a call beside it. Archiving driven by a merge rather than by a person is a third path, covered in `canon/context/claude-plugin/skill-archiving.md`, and it is what fixes the placement: the `post-merge` hook reaches the archive with nobody watching, so a second call is a second failure point that leaves the task archived and the plan live.

No ordering is forced any more, which is what retired the gate `task-board` used to route on. The two halves close in one act, so neither can run before the other and no caller is sent elsewhere first.

## Where a session fact lands

A fact a session learns is routed by owner rather than filed in one place. `memory-capture` classifies each candidate, and a project fact whose subject names an entry in `canon/context/index.md` goes to that entry, which the three-tier model already loads on demand. Everything else stays a memory file. The test is a named catalog entry rather than a judgment about fit, so it fails closed to memory when no entry matches or when two do.

Capture never edits a context entry. It appends the fact to `.canon/tmp/memory-routing/<slug>.md` and `docs-fold` folds it in, which keeps one skill writing those files. The handoff is a file rather than a spoken result so it survives a compaction between the two steps, and so a standalone capture leaves something a later `/docs-fold` consumes.

A routing file written under the `latest` slug collects facts for several domains and several sessions, so the branch consuming it owns only part of what it holds. On 2026-08-20 that file carried a section for `.claude/context/cli/commands.md` that the branch reading it needed and one for `.claude/context/ci.md` that it did not. A fold therefore takes one section at a time and deletes the file once no section is left, since folding it whole pulls an unrelated domain into the diff and deleting it whole discards a fact nobody read. <!-- audit-ignore-citations: .claude/context/cli/commands.md, .claude/context/ci.md -->

That ordering is why capture leads the sequence in `git-ship`, which is the one body stating it since `auto-ship` Step 7 was merged into an invocation of that skill. It ran after the pull request opened until routing shipped, which was invisible while every output was gitignored and would have stranded a context edit outside the branch the moment one existed.

`role-orchestrator` fires capture from its pre-compact handoff runbook, which reaches it through `session-map` and states the session does not commit so routing is skipped. Both other callers ship and this session never does, so without that step the session taking every operator correction records none. The refill sweep reports the debt instead of paying it, because a capture per batch of merges bills the operator a wait while nothing is being built. What this session produces is feedback about how to work.

An entry leaving the pen is archived to `.canon/tmp/memory-archive/` rather than deleted, and `.canon/memory/index.md` is generated by a hook rather than appended by hand. That archive kept its place under `.tmp/` when the plan and task archives moved out, because nothing cites a retired memory and the folder exists to undo a bulk judgment call rather than to be read later.

## The plan archive

Every stop the verb emits has to name a next step that actually moves. The archive is gated on the citing task's outcomes being all `[x]`, and a stop that routes past that gate returns the caller to the same guard unchanged. The citation count is not a gate at all: it decides whether the plan travels, and the task archives either way.

A plan that ships is archived rather than removed. `archiveTask` moves it from `.canon/plans/` to `.canon/plans/archive/`, then writes the task file's `Plan:` line at the new location as it lands in `.canon/tasks/archive/`, a folder deeper than the live pair. Retargeting is what makes the archive worth having, since an archive nothing points at is barely better than a deletion. A task already pointing into the archive moves on its own with nothing to carry, which keeps a second pass idempotent instead of acting on work it did itself.

### Reading the plan citation

The `Plan:` line carries a markdown link relative to `.canon/tasks/`, so both parsers read the target out of the parentheses and both resolve it against that folder before routing on it. Resolving is what lets `../plans/x.md` and the older bare `.canon/plans/x.md` land on the same file, and skipping it would drop every link-form task through to the sweep's final warn-and-skip branch, archiving nothing. The retarget writes a link back for the same reason it reads one: that branch is the only writer producing a `Plan:` line nobody authored, so emitting a bare path would convert the board to the old form one closing task at a time.

The plan travels only when the closing task is its last live citation. One plan can serve several tasks, and moving it on the first to close strands every other pointer at a path that no longer resolves. `.canon/plans/` is gitignored, so no history recovers the retarget and the shared plan stays put until the last citation closes.

The count compares the resolved target rather than the raw string, because a board holding one task written `../plans/x.md` and another written `.canon/plans/x.md` cites one plan and a raw comparison reads two, counts zero, and archives the file out from under a live task. Comparing basenames instead trades that for the mirror error, since a live plan and an archived one share a filename whenever a closed task still points into `.canon/plans/archive/`, so the count invents a citation and the plan is never archived.

### Why a scope belongs in the instruction

The sweep this replaced scanned the whole board, and it stated that scope in the sentence carrying the instruction rather than as a correction below it, because a scope stated as a correction loses to the instruction above it. A step opening with "sweep only scratch that was actually consumed this session" and asserting the opposite for plans four lines later gets read as session-scoped, and a run then swept its own plan and passed over every task that closed earlier. The lesson survives the sweep it was learned on, which is why the fix moved words rather than adding a rule.

## The board-sweep sandbox arm

The sandbox arm for this is `board-sweep`, kept separate from `drift`. Both now assert that a run marking outcomes moves no plan, `drift` for the task its prompt names and `board-sweep` for one the prompt never mentions, so a failure stays unambiguous between the two readings a session could take.

The arm carries a third task whose outcomes stay open and whose plan must survive the run. It is what separates a run that moved nothing from one that moved everything, since a fixture where every plan stays live reads the same under both until a task the run had no reason to touch is standing beside them. Its assertions cover each plan's location and each task's untouched `Plan:` line, since a run that retargeted a pointer without moving the file would leave the task aimed at an archive path holding nothing.

## Merging one skill into another absorbs the body

Merging one skill into another moves the body, not only the description. The survivor gains the absorbed behavior as a state-selected branch and the pointer left at the old name carries `disable-model-invocation: true` so it stops competing for routing. `claude-design-propose` proposed token values for a project with no code while `design-extract` sourced them from code and left a cell blank when nothing anchored it, so absorbing the triggers alone would have routed every greenfield caller to a body returning blanks. Where two bodies disagree rather than duplicate, the survivor branches on project state and never on a flag. Check also whether the absorbed skill's sandbox scenario can rename to the survivor, since the survivor's filename may already be taken.
