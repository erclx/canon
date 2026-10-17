---
title: Board validator
description: What canon tasks validate checks on the board, from shape and ordering to blockers, shared files, and folder claims
---

# Board validator

## Decisions

### Why the verb sits off the check

`canon tasks validate` measures gitignored per-machine scratch, which keeps it off `bun run check` and every hook. With no shared moment to hang it on, the sweep runbook in `claude/skills/role-orchestrator/references/orchestrator-sweep.md` calls it when the readiness claim is made.

`src/tasks/validate.ts` parses and checks while `src/commands/tasks.ts` renders, the split `archive.ts` already uses.

### Reading columns and groups

Board columns are read from each table's own header, not by position. A board laid out differently is reported for what it lacks rather than having its second cell read as something it never was.

- A task file is accounted for against `priority.md` and `backlog.md` in one check, so a task moving between them never reads as a dropped file
- An absent backlog reads as empty, and a task named by both is reported like a task in two groups
- A heading outside the three the standard fixes yields no group, which refuses rather than reporting a clean board nothing parsed

### Paths and stems

An absent `Touches` column and an unreadable one are one finding. Reporting only the second passed a `## Run now` table declaring no file set, where the shared-file report silently pairs nothing.

- A backticked span counts as a path when it holds a slash or ends in a letter-led extension, separating `commands.md` from a version ending in a digit <!-- audit-ignore-citations -->
- Reading a version as a path collides two rows that merely cite the same task
- `RESERVED_STEMS` is exported from `archive.ts` so the two verbs cannot disagree on what counts as a board sibling
- `isReservedStem` also matches any stem opening `session-`, since the pre-compaction handoff takes one file per session, and a handoff must not read as a task carrying no row

### Blocker citations

The blocker check reads citations out of the `Waiting on` cell and never parses it into fields. The board standard fixes three forms and leaves the cell prose, so a grammar written against today's phrasing meets cells nobody phrased that way.

- Both halves gate on a citation in the cell, not on a column beside it, because keying on `Touches` fires on any parked row whose files nothing running holds
- That row would then count as re-tested and leave the untested list, so a board whose blockers all still hold reports clean
- A cited task is a bare sibling filename. A target carrying a directory is a plan pointer, and reading its stem as a task would settle a row against a folder the plan is not in.
- The outcome list comes off `readOutcomes`, so the check cannot disagree with the archive and outcome verbs about which checkboxes are outcomes
- A cited task carrying no outcome box settles nothing, since a file the check could not parse is not evidence of a finished one

### Settling a blocker

A cited task that closed every outcome settles the row only once its `Pull request:` line names work the trunk carries. `task-complete` ticks outcomes at step two of the ship chain and `git-pr` opens the pull request later, so the checkbox alone reported four rows settled against branches still in review.

- A task closing every outcome with no pull request goes to the untested array, and so does one whose number no trunk ref answers for
- `src/tasks/trunk.ts` reads the trunk as the clone holds it, `origin/main` then local `main`, and never fetches, because a fetch per validate run is a cost the command does not carry
- A clone behind its remote under-reports a settled row rather than claiming work landed
- The trunk reader is injectable, so the check tests from a fixture rather than a git history
- A citation resolving in neither the board nor the archive takes `blocker-unresolved`, since naming an absent file archived claims something nobody wrote

### Untested rows move no exit code

Untested rows go to a second array rather than the findings. Three of the five blocker kinds rest on a person's judgment, and a clean findings list over parked rows that were never testable reads as a clean board.

### Readiness in the task list

`canon tasks list` derives each live file's readiness from `readBoard` and `readBacklog`, not a second parse of either file. The `readiness` values are the three `BOARD_GROUPS` names plus `backlog`, `unplaced`, and `both`, so no fourth spelling exists for a skill to key on.

- The verb lists the live root only, and an archive flag waits on a second concrete case
- A `backlog/` folder beside `archive/` and `declined/` was rejected, since backlog rows move in both directions where the other two hold terminal states
- A move would rewrite every bare sibling link and every `../plans/` origin line one folder deeper
- The folder and `backlog.md` would both state readiness, two sources in a gitignored corpus with no history

### Shared files

Two `## Run now` rows naming a path in common go to a `shared` array and move no exit code. The array lists candidates for merge order, since a `Touches` cell cannot say which hold a pair carries.

- A collision finding exiting 2 held while the dispatch gate serialized on a shared file
- Once the gate held only on a dependency, a contract, a relocation, a sweep, or a stated reason, it failed every sweep over two independent rows writing one canvas doc
- The entry names which row contributed the containing path, so an over-broad cell and a genuine overlap read differently
- `sharesPath` colliding a directory with a file inside it is the intended reading

### Folder claims

A `Touches` cell naming a bare folder goes to a third array, `claims`, and moves no exit code. A row rewriting a whole directory has no other way to say so, and a measure failing on a legitimate cell teaches a reader to skip it.

- Folder against file is decided by asking the tree for a path that resolves, and by extension only for a path the row has yet to create
- The name alone would read an extensionless file, such as a hook script, as a folder claim
- The claims scan stops at `## Run now` like the shared-file report, since a cell in another group describes unplanned work as a sentence

### Shape runs first

Shape runs ahead of every other check, since a row failing it carries no dependable fields. A blank or prose line ends the table above it, so a stranded row is checked against the line behind it and then cell by cell against its own header.

### Ordering

Ordering reads a `## Needs a plan` row's stated position off the walk that reads its other fields. The phrase is prose searched anywhere in the cell, `<ordinal> here` or the bare word `last`, since live rows state position at the end of a sentence.

- A gap, a duplicate, and a sequence not starting first all surface as one disagreement between stated and real position
- A cell stating no position is `row-unranked` rather than unordered, since reading it as unordered would reach zero rows while a board sorted by recency passes
- The two findings share one check, since Ordering already scopes to the group and reads a position phrase, and an eighth row in the docs table would split one question

### The comparative phrase

A comparative phrase is a closed verb list sharing a clause with a positional object, a `vNN.N` label or the word `group`, `row`, or `rows`. A bare verb test accepted `it closes a gap the reference gate leaves open`, which claims no position. The verb-plus-object test passes all 16 live cells and rejects it.

- The clause bound stops a verb in one half of a cell pairing with an object in the other
- `CLAUSE_BREAK` keeps its period away from digits on both sides, so `v80.4` survives the split as one token
- An ordinal exempts a row from the comparative half, being a comparative claim already checked for agreement

### Residue in the comparative check

A cell phrased comparatively and unusually reads as unranked, the false negative and the safe direction for a check over prose. `readOrdinal` took the same trade by bounding itself to a word list.

A vocabulary verb reaching a positional object non-positionally reads as ranked, the false positive.

- `it follows from two rows the audit already covers` and `it precedes no rows in any meaningful order` both pass while claiming no position
- Telling them from a positional `follows` is grading prose, which `readOrdinal` refused, so the regex leaves the class open

### Why the check proves little live

The live board passes once every row is phrased comparatively, so the fixture board in `validate.test.ts` is what exercises the finding. Encoding the check replaces holding that convention in one session's memory.

- `readOrdinal` reads the phrase anywhere in the cell, since every live row states its position mid-sentence or at the end
- The `last` branch reads `LAST_AT_END` rather than `\blast\b`, since `the last of the two instruments this rename needs` would otherwise resolve as a position claim
- `LAST_AT_END` anchors the bare word to the end of the cell, where every row declaring itself last puts it

### Wide code spans

A code span too wide for the preview goes to a fourth array, `wide`, and moves no exit code, since the threshold is a heuristic. The limit is 60 characters of longest whitespace-free run. The widest span measured fitting was 57 and 78 was measured overflowing, so 58 to 77 stays unmeasured.

- The wide scan reads every group, since the overflow that prompted it sat under `## Up next`
- It reads cells off `BoardRow.cells`, split by `splitCells`, and strips a link target because only the label renders
- A brace-glob flags at any width
- Only code spans are read, since the preview draws a wide table with a sideways scroll while prose breaks at spaces and a bare word at a hyphen
