---
name: task-board
description: Creates a task file in `.canon/tasks/` with the filename, phase label, and frontmatter the standard requires, and archives a shipped one out of the folder. Use when asked to "add a task", "create a task", "queue this", "put this on the board", "archive that task", or "close out a shipped task". Do NOT use to mark an outcome `[x]`. That is `context-fold`.
---

# Task board

Owns the two operations that bring a task file into existence and take it out of the folder. `context-fold` edits the contents of a task that already exists, marking outcomes `[x]`. Do not mark outcomes here, and do not move a plan by hand: the archive carries it.

Read `${CLAUDE_SKILL_DIR}/../../standards/tasks.md` before writing any file. It holds the filename convention, the frontmatter contract, and the file format. Do not work them from memory.

## Guards

- Resolve the board at the main worktree root, not `pwd`. Run `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`, falling back to `pwd` outside a git repo. Every read and write below resolves against that root. The board is gitignored scratch shared across worktrees, so a linked worktree writing to its own `pwd` creates a second board nothing else reads.
- A new task file is a main-root write, so it goes out as a heredoc. Archiving already runs through `canon tasks archive`, which resolves the root in-process. Marking an outcome shipped is `context-fold` and runs through `canon tasks outcome`. Resolve that root and route the write the way `session-worktree` states.
- If `.canon/tasks/` does not exist at that root, stop: `❌ No .canon/tasks/ board. Run canon claude init to set it up.`
- Route on the request rather than on a flag. Creating names work that does not exist yet, archiving names a task file already shipped, and declining names one decided against. If the request fits none of the three, stop: `❌ Ambiguous. Say whether to create a task, archive one, or decline one.`
- Never hand-edit `.canon/tasks/index.md`. A hook regenerates it from sibling frontmatter after a write. Do not run the regen command directly, except after a shell write from a linked worktree: the hook matches `Write|Edit|MultiEdit` and nothing fires on `Bash`, so that one case regenerates explicitly with `canon indexes regen --no-stage --root <main-root> <main-root>/.canon/tasks/index.md`.

## Create

### Step 1: require an origin

Every task traces to a plan, a groundwork folder, an intake folder, or a GitHub issue. Ask for it when the request does not carry one, and stop rather than guessing: `❌ No origin. Name the plan, groundwork folder, intake folder, or issue this task comes from.`

A task with no origin is either lost context or work nobody decided to do. This is the only moment the invariant is enforceable, because it is the only moment a task file comes into existence.

Accept work whose origin is the conversation itself only when the user says so explicitly, and record what it was in the intro paragraph instead of writing a link line to a file that does not exist.

### Step 2: allocate the phase label

Run `canon tasks next-label --claim --json` and take its `label` field. The verb reads the live board and its `archive/` sibling together, so the label it returns accounts for what the board alone no longer shows, and `--claim` reserves it under `.canon/ordinal-locks/` so a second session filing at the same moment gets the next one. Branch on the record's `reason` rather than the exit: `label-contended` means re-run the claim, and a usage error from an unknown `--claim` means the installed binary predates the flag, so report the verb as unavailable rather than falling back to a bare read, which reopens the race.

Do not derive the label from a version file. `${CLAUDE_SKILL_DIR}/../../standards/versioning.md` permits free renumbering, so the verb's two folders are the only surface that knows what a label currently means.

### Step 3: write the file

Write `.canon/tasks/vXX.Y-<slug>.md` under the claimed label, reading the file first if a session ever stubbed it, following the format in `${CLAUDE_SKILL_DIR}/../../standards/tasks.md`. Include a link line only when the file or folder it names exists. A link to a plan nobody has written yet is the broken pointer the archive rules exist to prevent.

Write `Plan:`, `Groundwork:`, and `Intake:` as markdown links relative to `.canon/tasks/`, as in `Plan: [feature-<slug>](../plans/feature-<slug>.md)`. Leave `Issue:` a bare `#NNN`. A task written in the older bare-path form still parses, so it costs the board a clickable line rather than an archive, but it leaves the board in two shapes for every reader after.

Never write a `Pull request:` line here. `git-pr` adds it when a pull request opens, and a number guessed at create time points at someone else's work.

Write it immediately. Claude Code's tool permission dialog is the confirmation gate. Do not pause for approval.

### Step 4: place it on a surface

A task file with no row is a dropped task, so name the surface it lands on in the same pass that creates it. A task that would plausibly be planned within the next few waves takes a row under `## Needs a plan` in `.canon/tasks/priority.md`, positioned by where it sits against the rows already there, with the reason for that position in its `Waiting on` cell. Anything else takes a line in `.canon/tasks/backlog.md`, which is unordered and where in the file it goes means nothing.

The test and both file shapes are in `${CLAUDE_SKILL_DIR}/../../standards/board.md`.

Check the roster for a live orchestrator before writing either file. Read `canon sessions list --self --json` for this session's own `sessionId` and `name`, then read `canon sessions list --json` and match a row whose `repository` matches this session's own, whose `sessionId` differs from it, and whose `name` starts with `orchestrator-`. That is the convention every hand-launched controller on this machine currently uses, and it excludes every `worker-` and `planner-` session cleanly. Treat a refusal from either call the same as a roster read that failed.

- **Found.** Do not write `priority.md` or `backlog.md`. Report the surface the row would take and the reason worked out above, then hand off by messaging that session with the same information so it places the row itself rather than two sessions writing the board at once.
- **Not found, and this session's own name (already read above) starts with `worker-` or `planner-`.** Do not write either file. Those two role bodies ban a board write with no exception, and an orchestrator absent from the roster is not consent to break it. Report the row and the surface it would take, so the operator or a later orchestrator places it.
- **Not found otherwise, or the roster read fails.** Write the row directly, as today. A failed read is indistinguishable from a solo project holding no orchestrator, and stopping would strand the row on the one path this section otherwise keeps unconditional. The row is a main-root write too, so it lands through the same heredoc route the file itself took.

Say which branch fired and why in the report. The call is a judgment restated on every sweep rather than a property of the task, and a placement with no stated reason is one the next sweep re-derives from nothing.

### Step 5: report unlinked origins

Scan for work that has been decided and would otherwise be forgotten. Three origins carry it, and every run reads all three.

List `.canon/groundwork/` and run `gh issue list --state open` when a remote is configured, then grep the board for each track name and issue number. Report any with no task, one line each.

Read the dumps through `canon intake list --json`, which reports items, open, unread, and malformed per folder and owns the parse of the answer contract `${CLAUDE_SKILL_DIR}/../../standards/intake.md` fixes. Then grep `.canon/tasks/`, `.canon/tasks/archive/`, and `.canon/tasks/declined/` for each folder slug. A dump with no live task is the ordinary shape of one already promoted and either shipped or declined, so a check reading the board by itself reports every settled folder as abandoned.

A dump is the stronger case for this scan rather than the weaker one. A track holds one question and stays visible, while a dump holds dozens of items whose verdicts were reached and then left with nothing carrying them forward.

Those two reads give four states, and the first three earn a line each:

- Every item answered, `malformed` at zero, and none of the board, the archive, or the declined folder cites it. Decided work nobody promoted, which is what this step exists to find.
- Unread items. The folder is waiting on the operator rather than forgotten, so it takes its own wording and never lands in the block above.
- `malformed` above zero. An item carrying no answer slot can be reached by no verb, so name the folder as a file to repair rather than as work in either state above.
- The archive cites it. Promoted and shipped, so say nothing.

`malformed` is why the first state tests two counts rather than one. A malformed item is neither unread nor answered, so reading `unread` alone folds it onto the answered side and reports a broken file as decided work nobody promoted.

Say which read fired. "No task points at this" is true of every reported state and useful about none of them.

Report rather than prompt. A track can be opened long after its task would have been written, so an offer to create one for each is noise on most runs, and that reasoning covers a dump unchanged.

Say the origins were read even when nothing comes back, which is the ordinary result. A step going silent on a clean pass is indistinguishable from one that never ran.

## Archive

Read `${CLAUDE_SKILL_DIR}/references/archive.md` when the request names a shipped task to archive. It carries the check that the work reached `main`, the `canon tasks archive` call, the route for each refusal, and the prose to clear afterwards. Never move the file, edit `priority.md`, or regenerate the index by hand, since the command owns all three.

## Decline

Read `${CLAUDE_SKILL_DIR}/references/decline.md` when the request names a task decided against. It carries gathering the reason, the `canon tasks decline` call, the route for each refusal, and the prose to clear afterwards. Never move the file, edit `priority.md` or `backlog.md`, or regenerate the index by hand, since the command owns all three.

## Output

Emit the full relative path from the project root for every file written or moved. A bare filename names a file the reader cannot open.

Create:

```plaintext
✅ Created: .canon/tasks/vXX.Y-<slug>.md

<label>, next after <highest>.
<board or backlog, and why it landed there>.

**Origin with no task:**

- `.canon/groundwork/<slug>/`: open, touched <date>
- `.canon/intake/<slug>/`: every item answered, nothing promoted
- #NNN: <issue title>

**Waiting on you:**

- `.canon/intake/<slug>/`: <n> of <n> items unread
- `.canon/intake/<slug>/`: <n> items carry no answer slot, so no verb reaches them
```

Drop either block when it carries no rows. When both are empty, which is the ordinary result, replace them with one line naming what was read: `Read <n> tracks, <n> dumps, and <n> open issues. Nothing unlinked.`

Archive, reporting the paths the command returned:

```plaintext
📦 Archived: .canon/tasks/archive/vXX.Y-<slug>.md

<ordering and index disposition in one line>
```

A refusal reports the reason and the resolution the mode's reference routes it to under its Step 3, on one line each.
