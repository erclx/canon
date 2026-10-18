---
name: task-board
description: Creates a task file in `.canon/tasks/` with the filename, phase label, and frontmatter the standard requires, and declines one decided against. Use when asked to "add a task", "create a task", "queue this", "put this on the board", or "decline that task". Do NOT use to mark an outcome `[x]` or to archive a shipped task. That is `task-complete`.
metadata:
  family: decide
---

# Task board

Owns the two operations that decide a task: bringing its file into existence, and declining one decided against. `task-complete` settles a task once its work exists, so do not mark outcomes, archive, or move a plan by hand here.

Read `${CLAUDE_SKILL_DIR}/references/tasks.md` before writing any file. It holds the filename convention, the frontmatter contract, and the file format. Do not work them from memory.

## Guards

- Resolve the board at the main worktree root with `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`, falling back to `pwd` outside a git repo
  - The board is gitignored scratch shared across worktrees, so a linked worktree writing its own `pwd` creates a second board nothing reads
- A new task file is a main-root write, so it goes out as a heredoc, routed the way `session-worktree` states. Declining runs through `canon tasks decline`, which resolves the root itself.
- If `.canon/tasks/` does not exist at that root, stop: `❌ No .canon/tasks/ board. Run canon claude init to set it up.`
- Never hand-edit `.canon/tasks/index.md`, which a hook regenerates from sibling frontmatter after a write

### Routing the request

Route on the request rather than on a flag. Creating names work that does not exist yet, and declining names a task decided against.

- Archiving or marking outcomes belongs to `task-complete`, so name it and stop
- If the request fits neither, stop: `❌ Ambiguous. Say whether to create a task or decline one.`

### Regenerating the index by hand

Do not run the regen command directly, except after a shell write from a linked worktree. The hook matches `Write|Edit|MultiEdit` and nothing fires on `Bash`, so that one case runs `canon indexes regen --no-stage --root <main-root> <main-root>/.canon/tasks/index.md`.

## Create

### Decide a task is needed

Open a task only for work that spans multiple sessions or has real dependencies, and handle a small edit immediately without one.

- Add no task for work already completed, since git shows it
- Give a task needing execution detail beyond its own file a plan in `.canon/plans/`, linked by its `Plan:` line per Step 3

### Step 1: require an origin

Every task traces to a plan, a groundwork folder, an intake folder, or a GitHub issue. Ask for it when the request does not carry one, and stop rather than guessing: `❌ No origin. Name the plan, groundwork folder, intake folder, or issue this task comes from.`

A task with no origin is lost context or work nobody decided to do, and creation is the only moment the invariant is enforceable. Accept an origin in the conversation itself only when the user says so, recording it in the intro paragraph rather than a link line.

### Stop a worker before it claims a label

A session that asserted `canon:role-worker` this run, or whose own name in `canon sessions list --self --json` starts with `worker-`, stops here. It claims no label and writes no file.

- Report the row's title, its origin, and the surface it would take to the controlling session instead, since placing the row is that session's call
- The guard sits ahead of Step 2 because `--claim` reserves a label on disk, so a later stop leaves a reservation nothing uses
- It names the worker role alone. A planner closing a groundwork track still writes its task file here and reaches Step 4's roster check.

### Step 2: allocate the phase label

Run `canon tasks next-label --claim --json` and take its `label` field. The verb reads the live board and its `archive/` sibling together, and `--claim` reserves the label under `.canon/ordinal-locks/` so a concurrent session gets the next one.

- Branch on the record's `reason` rather than the exit. `label-contended` means re-run the claim.
- A usage error from an unknown `--claim` means the binary predates the flag. Report the verb unavailable rather than falling back to a bare read, which reopens the race.
- Do not derive the label from a version file. `${CLAUDE_SKILL_DIR}/../git-commit/references/versioning.md` permits free renumbering, so only the verb's two folders know what a label means.

### Step 3: write the file

Write `.canon/tasks/vXX.Y-<slug>.md` under the claimed label, reading the file first if a session ever stubbed it, following the format in `${CLAUDE_SKILL_DIR}/references/tasks.md`. Write it immediately, since Claude Code's tool permission dialog is the confirmation gate.

- Include a link line only when the file or folder it names exists, since a link to an unwritten plan is the broken pointer the archive rules prevent
- Write `Plan:`, `Groundwork:`, and `Intake:` as markdown links relative to `.canon/tasks/`, as in `Plan: [feature-<slug>](../plans/feature-<slug>.md)`
- Leave `Issue:` a bare `#NNN`. The older bare-path form still parses, but it leaves the board in two shapes for every later reader.
- Never write a `Pull request:` line here. `git-pr` adds it when a pull request opens, and a number guessed now points at someone else's work.

### Step 4: place it on a surface

A task file with no row is a dropped task, so name its surface in the same pass that creates it. The test and both file shapes are in `${CLAUDE_SKILL_DIR}/references/board.md`.

| Task                                        | Surface                                                                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Plausibly planned within the next few waves | A row under `## Needs a plan` in `.canon/tasks/priority.md`, through `canon tasks place <stem> --group needs-a-plan --waiting "<reason>"` |
| Anything else                               | A line in `.canon/tasks/backlog.md`, which is unordered                                                                                   |

Position the row against its siblings with `--before <stem>` or `--after <stem>`, and state what it ranks against in the reason.

### Check for a live orchestrator

Check the roster before writing either file. Read `canon sessions list --self --json` for this session's own `sessionId` and `name`, then match a row in `canon sessions list --json` against three tests.

- Its `repository` matches this session's own, and its `sessionId` differs
- Its `name` starts with `orchestrator-`, the convention every hand-launched controller here uses, which excludes every `worker-` and `planner-` session
- Treat a refusal from either call the same as a roster read that failed

| Roster read                                                                | Act                                                                                                     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Found**                                                                  | Write neither file. Report the surface and reason, and message that session so it places the row itself |
| **Not found**, and this session's name starts with `worker-` or `planner-` | Write neither file, since both role bodies ban a board write. Report the row and its surface.           |
| **Not found otherwise**, or the read fails                                 | Place the row through `canon tasks place`. A failed read looks like a solo project.                     |

Say which branch fired and why in the report. A placement with no stated reason is one the next sweep re-derives from nothing.

### Step 5: report unlinked origins

Scan for work that has been decided and would otherwise be forgotten. Three origins carry it, and every run reads all three.

- List `.canon/groundwork/` and run `gh issue list --state open` when a remote is configured, then grep the board for each track name and issue number
- Read the dumps through `canon intake list --json`, which reports items, open, unread, and malformed per folder, and parses the contract `${CLAUDE_SKILL_DIR}/../plan-intake/references/intake.md` fixes
- Grep `.canon/tasks/`, `.canon/tasks/archive/`, and `.canon/tasks/declined/` for each folder slug, since a dump with no live task is usually promoted and settled

A dump is the stronger case for this scan. A track holds one question and stays visible, while a dump holds dozens of verdicts left with nothing carrying them forward.

### The four dump states

Those reads give four states, and the first three earn a line each.

| State                                                                   | Report                                                               |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Every item answered, `malformed` at zero, nothing on any board cites it | Decided work nobody promoted, which is what this step exists to find |
| Unread items                                                            | Waiting on the operator rather than forgotten, in its own wording    |
| `malformed` above zero                                                  | A file to repair, since no verb reaches an item with no answer slot  |
| The archive cites it                                                    | Promoted and shipped, so nothing                                     |

The first state tests two counts because a malformed item is neither unread nor answered. Reading `unread` alone reports a broken file as decided work nobody promoted.

### How to report it

Say which read fired, since "No task points at this" is true of every state and useful about none of them.

- Report rather than prompt. A track can open long after its task would have been written, so an offer per origin is noise on most runs.
- Say the origins were read even when nothing comes back, since a silent clean pass looks like one that never ran

## Decline

Read `${CLAUDE_SKILL_DIR}/references/decline.md` when the request names a task decided against. It carries gathering the reason, the `canon tasks decline` call, the route for each refusal, and the prose to clear afterwards.

Never move the file, edit `priority.md` or `backlog.md`, or regenerate the index by hand, since the command owns all three.

## Output

Emit the full relative path from the project root for every file written or moved, since a bare filename names a file the reader cannot open. A create run reads `${CLAUDE_SKILL_DIR}/references/create-report.md` for the report block and when each part drops. A decline run skips it.

A refusal reports the reason and the resolution the mode's reference routes it to under its Step 3, on one line each.
