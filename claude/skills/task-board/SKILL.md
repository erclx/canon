---
name: task-board
description: Creates a task file in `.canon/tasks/` with the filename, phase label, and frontmatter the standard requires, and archives a shipped one out of the folder. Use when asked to "add a task", "create a task", "queue this", "put this on the board", "archive that task", or "close out a shipped task". Do NOT use to mark an outcome `[x]`. That is `docs-fold`.
---

# Task board

Owns the two operations that bring a task file into existence and take it out of the folder. `docs-fold` edits the contents of a task that already exists, marking outcomes `[x]`. Do not mark outcomes here, and do not move a plan by hand: the archive carries it.

Read `${CLAUDE_SKILL_DIR}/../../standards/tasks.md` before writing any file. It holds the filename convention, the frontmatter contract, and the file format. Do not work them from memory.

## Guards

- Resolve the board at the main worktree root, not `pwd`. Run `git worktree list --porcelain | grep -m 1 '^worktree ' | cut -d' ' -f2-`, falling back to `pwd` outside a git repo. Every read and write below resolves against that root. The board is gitignored scratch shared across worktrees, so a linked worktree writing to its own `pwd` creates a second board nothing else reads.
- From a linked worktree the file-editing tools refuse that root, so a new task file goes out through `Bash` as a plain single command carrying a heredoc. Archiving already runs through `canon tasks archive`, which resolves the root in-process. Marking an outcome shipped is `docs-fold` and runs through `canon tasks outcome`. Resolve that root the way `session-worktree` does.
- If `.canon/tasks/` does not exist at that root, stop: `❌ No .canon/tasks/ board. Run canon claude init to set it up.`
- Route on the request rather than on a flag. Creating names work that does not exist yet, archiving names a task file already shipped, and declining names one decided against. If the request fits none of the three, stop: `❌ Ambiguous. Say whether to create a task, archive one, or decline one.`
- Never hand-edit `.canon/tasks/index.md`. A hook regenerates it from sibling frontmatter after a write. Do not run the regen command directly, except after a shell write from a linked worktree: the hook matches `Write|Edit|MultiEdit` and nothing fires on `Bash`, so that one case regenerates explicitly with `canon indexes regen --no-stage --root <main-root> <main-root>/.canon/tasks/index.md`.

## Create

### Step 1: require an origin

Every task traces to a plan, a groundwork folder, an intake folder, or a GitHub issue. Ask for it when the request does not carry one, and stop rather than guessing: `❌ No origin. Name the plan, groundwork folder, intake folder, or issue this task comes from.`

A task with no origin is either lost context or work nobody decided to do. This is the only moment the invariant is enforceable, because it is the only moment a task file comes into existence.

Accept work whose origin is the conversation itself only when the user says so explicitly, and record what it was in the intro paragraph instead of writing a link line to a file that does not exist.

### Step 2: allocate the phase label

Run `canon tasks next-label --json` and take its `label` field. The verb reads the live board and its `archive/` sibling together, so the label it returns accounts for what the board alone no longer shows.

Do not derive the label from a version file. `${CLAUDE_SKILL_DIR}/../../standards/versioning.md` permits free renumbering, so the verb's two folders are the only surface that knows what a label currently means.

### Step 3: write the file

Write `.canon/tasks/vXX.Y-<slug>.md` following the format in `${CLAUDE_SKILL_DIR}/../../standards/tasks.md`. Include a link line only when the file or folder it names exists. A link to a plan nobody has written yet is the broken pointer the archive rules exist to prevent.

Write `Plan:`, `Groundwork:`, and `Intake:` as markdown links relative to `.canon/tasks/`, as in `Plan: [feature-<slug>](../plans/feature-<slug>.md)`. Leave `Issue:` a bare `#NNN`. A task written in the older bare-path form still parses, so it costs the board a clickable line rather than an archive, but it leaves the board in two shapes for every reader after.

Never write a `Pull request:` line here. `git-pr` adds it when a pull request opens, and a number guessed at create time points at someone else's work.

Write it immediately. Claude Code's tool permission dialog is the confirmation gate. Do not pause for approval.

### Step 4: place it on a surface

A task file with no row is a dropped task, so name the surface it lands on in the same pass that creates it. A task that would plausibly be planned within the next few waves takes a row under `## Needs a plan` in `.canon/tasks/priority.md`, positioned by where it sits against the rows already there, with the reason for that position in its `Waiting on` cell. Anything else takes a line in `.canon/tasks/backlog.md`, which is unordered and where in the file it goes means nothing.

The test and both file shapes are in `${CLAUDE_SKILL_DIR}/../../standards/tasks.md`.

Check the roster for a live orchestrator before writing either file. Read `canon sessions list --self --json` for this session's own `sessionId` and `name`, then read `canon sessions list --json` and match a row whose `repository` matches this session's own, whose `sessionId` differs from it, and whose `name` starts with `orchestrator-`. That is the convention every hand-launched controller on this machine currently uses, and it excludes every `worker-` and `planner-` session cleanly. Treat a refusal from either call the same as a roster read that failed.

- **Found.** Do not write `priority.md` or `backlog.md`. Report the surface the row would take and the reason worked out above, then hand off by messaging that session with the same information so it places the row itself rather than two sessions writing the board at once.
- **Not found, and this session's own name (already read above) starts with `worker-` or `planner-`.** Do not write either file. Those two role bodies ban a board write with no exception, and an orchestrator absent from the roster is not consent to break it. Report the row and the surface it would take, so the operator or a later orchestrator places it.
- **Not found otherwise, or the roster read fails.** Write the row directly, as today. A failed read is indistinguishable from a solo project holding no orchestrator, and stopping would strand the row on the one path this section otherwise keeps unconditional. From a linked worktree the file-editing tools refuse the main root, so the row lands through the same `Bash` route the file itself took.

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

The `post-merge` git hook archives the task a merge closed, so a request arriving here is usually one the hook could not resolve on its own. Run the steps below against whatever the hook left in place.

Do not move the file, edit `priority.md`, or regenerate the index by hand. `canon tasks archive` owns all three as one unit and the hook calls the same command, so a hand-rolled move here drifts from the unattended path.

### Step 1: confirm the work reached main

`docs-fold` marks outcomes on the branch as step 1 of the ship chain, so an all-`[x]` task routinely describes a pull request that is still open. The command gates on the outcomes and cannot tell those two apart, which is what puts this check here:

```bash
git fetch origin main --quiet && git log origin/main --oneline -20
```

Match the shipped outcomes against that log, widening to `gh pr list --state merged --limit 20` when a remote is configured and the log does not settle it. When the work is not on `main`, name the task and stop: `❌ Work not on main. Archiving now loses the task if the pull request is abandoned.`

The board is gitignored, so an archived task has no history behind it and nothing restores one archived early. Skip this check when the task carries a `Pull request:` line and that pull request is merged, since the number already proves what the log is being read for.

### Step 2: run the archive

Pass the task's filename stem, or the pull request number when the request names one:

```bash
canon tasks archive <stem> --json
```

The command refuses rather than reports, and the refusal reaches this skill through the record rather than through the exit. Branch on `ok`, then on `reason`. An operator's shell profile may wrap `canon` in a function that runs the binary and then a second command and takes the second status, which masks every non-zero exit rather than only an absent verb. The binary exits 1 for an unknown subcommand and 1 for an ordinary refusal alike, so the record is the only signal that survives the wrapper.

On success the record carries `from`, `to`, `priorityRowRemoved`, and `indexRegenerated`, which is what moved, what row it cleared, and whether the index changed. It also carries `plan` when the task was the last live citation of a live plan, holding the `from` and `to` of the plan moved alongside it. A `plan` of `null` means the task cited no live plan, or that a sibling still holds it.

### Step 3: route on a refusal

Each reason has one resolution and none of them is to archive around it:

- `open-outcomes`: the named outcomes are unmarked or genuinely open. Run `docs-fold` when the work shipped and nothing marked it. Leave the task on the board when the outcome is real. When the work is being abandoned, cut it by striking the body, `- ~~<outcome>~~ <why>`, whatever the checkbox holds, so the board records what was dropped rather than meeting this refusal a second time.
- `ambiguous`: two tasks name one pull request, which is the misfile `${CLAUDE_SKILL_DIR}/../../standards/tasks.md` rules out. Resolve the citation by hand, since no sweep repairs it.
- `no-match`: the stem or number names nothing on the board. Check the name against the listed stems.
- `bad-input`: the command line was wrong rather than the board. Read the message, fix the arguments, and run it again. Nothing on the board needs repair, which is what separates this from the two above.

Do not move a plan by hand from this skill. The command carries the plan with the task when no other live task cites it, and retargets the archived task's `Plan:` line at the new path. A second mover drifts into relocating the same file differently.

Leave `TASK-ARCHIVE.md` alone when it is present in the archive folder. It records the single-file era in the shape that era used, and splitting it would fabricate per-task files nobody wrote.

### Step 4: clear prose naming the task

The command drops the task's row from `.canon/tasks/priority.md` and leaves prose alone. Remove any sentence that still names the archived task or counts the rows that changed, since a stale count reads as board state.

## Decline

A task decided against carries no `post-merge` hook of its own, so every decline request arrives here directly rather than through work the hook already did.

Do not move the file, edit `priority.md` or `backlog.md`, or regenerate the index by hand. `canon tasks decline` owns all three as one unit.

### Step 1: gather the reason

Ask for the reason when the request does not carry one, and stop rather than guessing: `❌ No reason. Say why the task is being declined.` The command takes it as `--reason <text>` and refuses without it, so gathering it here saves a round trip through that refusal.

### Step 2: run the decline

Pass the task's filename stem:

```bash
canon tasks decline <stem> --reason "<text>" [--by <name>] --json
```

The command refuses rather than reports, and the refusal reaches this skill through the record rather than through the exit, the same wrapper hazard `canon tasks archive` carries. Branch on `ok`, then on `reason`.

On success the record carries `from`, `to`, `priorityRowRemoved`, `backlogRowRemoved`, and `indexRegenerated`, where `backlogRowRemoved` is decline's own field since a task can be declined straight off `backlog.md` and archive never checks that file. It also carries `plan` when the task was the last live citation of a live plan, holding the `from` and `to` of the plan moved alongside it, the same shape `canon tasks archive` uses for its own `plan` field.

### Step 3: route on a refusal

- `no-match`: the stem does not name exactly one task. Either none matches, or exactly one starts with it and the full name is needed. Check the name against the listed stems.
- `ambiguous`: the stem is a prefix more than one task starts with, unlike archive's own `ambiguous`, which fires on a shared pull request. Decline takes no pull-request selector, so this is the only route to it. Pass the full stem.
- `bad-input`: the command line was wrong rather than the board. Read the message, fix the arguments, and run it again. Nothing on the board needs repair, which is what separates this from the two above.

Do not move a plan by hand from this skill. The command carries the plan with the task when no other live task cites it, and retargets the declined task's `Plan:` line at the new path. A second mover drifts into relocating the same file differently.

### Step 4: clear prose naming the task

The command drops the task's row from `.canon/tasks/priority.md` or `.canon/tasks/backlog.md` and leaves prose alone. Remove any sentence that still names the declined task or counts the rows that changed, since a stale count reads as board state.

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

A refusal reports the reason and the resolution Step 3 routes it to, on one line each.
