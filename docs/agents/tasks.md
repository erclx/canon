---
title: Tasks
description: Selecting a shipped task by stem or pull request, recording a number and closing an outcome, deriving the branch a dispatch and a worker both take, the refusal reasons, the board and backlog checks validate runs, and why the board root defaults to the main worktree
---

# Tasks

## Next label

`canon tasks next-label` reports the next unused phase label, reading `.canon/tasks/` and its `archive/` sibling together. A scan confined to the live board is blind to every label the archive already spent, which is what let two sessions hand out the same label within minutes of each other. It reports and never writes.

```bash
canon tasks next-label
canon tasks next-label --json
```

| Option          | Effect                                      |
| --------------- | ------------------------------------------- |
| `--json`        | Emit a machine-readable record on stdout    |
| `--root <path>` | Board root, defaulting to the main worktree |

The record carries `label`, the next free `vXX.Y`, and `highest`, the label it was derived from. `highest` is absent when neither folder carries a label yet, and `label` reads `v01.0` in that case, matching the zero-padded-major shape every other label already takes. <!-- canon-allow-reference: illustrates the verb's answer for a board holding no label yet, not a citation of a real task -->

Exit codes: `0` derived, `1` refused with `no-board`.

The minor digit rolls from 9 to 0 on the next major rather than growing a second digit, which is the single-digit-minor shape every phase label already takes. `canon tasks archive` moves a task's file from the live folder into the archive without renumbering it, so the same label counts toward the maximum wherever it currently sits, and a label claimed by two different files folds into the same scan without a dedicated check.

It reports rather than gates. Two sessions calling it in the same second can still take the same answer, since the board is gitignored files rather than a store with a lock, and `standards/versioning.md` permits free renumbering, so a collision costs a rename rather than anything worse.

```bash
canon tasks next-label --json | jq -r '.label'
```

## Archive

`canon tasks archive` moves a shipped task from `.canon/tasks/` into `.canon/tasks/archive/`, drops its row from `priority.md`, and regenerates the board index. The three run as one unit, so the attended and unattended callers cannot archive differently.

Name the task by its filename stem, or by the pull request it carries:

```bash
canon tasks archive v28.1-trigger-escalation # canon-allow-reference: illustrates the stem-selection form, not a citation of a real task
canon tasks archive --pull-request 673 --json
```

| Option               | Behavior                                                     |
| -------------------- | ------------------------------------------------------------ |
| `--pull-request <n>` | Select the task whose `Pull request:` line names this number |
| `--json`             | Emit a machine-readable record on stdout                     |
| `--root <path>`      | Board root, defaulting to the main worktree                  |

Exit codes: `0` archived, `1` refused. Every gate is a refusal rather than a warning, because `.husky/post-merge` calls this with nobody watching. The `reason` field carries which gate fired: `no-board`, `no-match`, `ambiguous`, `no-outcomes`, `open-outcomes`, or `bad-input`.

An outcome whose body is struck reads as cut rather than open or closed, whatever its checkbox holds: `- ~~<outcome>~~ <why>`. A task carrying only cut outcomes archives, since the gate refuses `no-outcomes` only when both the closed and the cut counts are zero. The success record carries `closed` and `cut` as counts, so a reader tells a shipped task from an abandoned one without opening the file.

The task carries its plan with it. When the closing task is the last live one whose `Plan:` line resolves onto that file, the plan moves to `.canon/plans/archive/` under its own name and the archived task's line is rewritten as `Plan: [feature-<slug>](../../plans/archive/feature-<slug>.md)`, a folder deeper than the live task wrote it. The `plan` field on the success record carries that `from` and `to`, and is `null` when nothing moved.

A plan several tasks share stays where it is, and the task archives anyway. Moving it on the first task to close strands every sibling's pointer at a path that has gone, and `.canon/plans/` is gitignored so no history recovers the target. A `Plan:` line resolving to no file leaves the plan alone too, since a pointer somebody typed wrong is not a plan to move and holding the whole archive over it would park the board behind a repair the merge cannot make.

The merge is what settles a plan. `.husky/post-merge` reads the pull request number off the squash subject and calls this verb, so both halves close in one act with nobody naming a file. That is why the move sits inside this verb rather than in a second call the hook would make after it, which could leave the task archived and the plan live.

`bad-input` covers a malformed command line, which all three task verbs answer the same way. It is separate from `ambiguous` and `no-match` because those describe the board, and a caller that passed two selectors would otherwise be sent to repair a task citation that is fine.

The row is matched by the link in its first cell rather than by a pattern against the whole line. A row names the task it is about in the first cell, so a link anywhere after it is a reference, such as a blocker naming what it waits on, and matching the line would drop the referring task's row too.

The row removal reaches `priority.md` alone. A task gets to a merge by being planned and handed out, and both steps move it onto the board first, so one archived straight off `backlog.md` leaves its bullet standing and `canon tasks validate` reports that bullet as naming a file that is gone.

The board is shared scratch at the main worktree root, so `--root` defaults to the first entry of `git worktree list` rather than the working directory. A linked worktree archives against the same board every other session reads.

Skills branch on the reason rather than on the exit code:

```bash
canon tasks archive --pull-request 673 --json | jq -r 'if .ok then .task else .reason end'
```

## Decline

`canon tasks decline <task>` moves a task decided against from `.canon/tasks/` into `.canon/tasks/declined/`, clears whichever of `priority.md` or `backlog.md` holds its row, and regenerates the board index. Unlike `canon tasks archive`, it carries no outcome-state gate: a task can be decided against at any outcome state.

```bash
canon tasks decline v28.1-trigger-escalation --reason "superseded by v30.2" # canon-allow-reference: illustrates the stem-selection form, not a citation of a real task
canon tasks decline v28.1-trigger-escalation --reason "no longer needed" --by Alex --json
```

| Option            | Behavior                                          |
| ----------------- | ------------------------------------------------- |
| `--reason <text>` | Why the task was decided against, required        |
| `--by <name>`     | Who decided, defaulting to `git config user.name` |
| `--json`          | Emit a machine-readable record on stdout          |
| `--root <path>`   | Board root, defaulting to the main worktree       |

Exit codes: `0` declined, `1` refused. The `reason` field carries which gate fired: `no-board`, `no-match`, `ambiguous`, or `bad-input`. `bad-input` covers a missing `--reason` and a `--by` that resolves to nobody, git config included.

`DECLINE_REFUSALS` is kept apart from archive's own refusal set on purpose. Archive and decline answer different questions, shipped versus decided-against, and a shared gate would let one archive a task that cannot yet ship or decline one that already has.

The decision is written onto the task as a `Declined: <reason>, <who> on <YYYY-MM-DD>` line, anchored the same way `Pull request:` is, after the last origin line the task carries.

The task carries its plan with it the same way archive does, when the declining task is the last live citation. A declined task's plan lands in `.canon/plans/archive/`, indistinguishable from a shipped one by folder alone. The task file under `.canon/tasks/declined/` is what records which it was.

Skills branch on the reason rather than on the exit code, the same rule `canon tasks archive` states:

```bash
canon tasks decline v28.1-trigger-escalation --reason "superseded by v30.2" --json | jq -r 'if .ok then .task else .reason end' # canon-allow-reference: illustrates the stem-selection form, not a citation of a real task
```

## Plan citations

`canon tasks plan-citations <stem>` answers where a task's plan sits and which other live tasks hold it. It reports and never writes.

| Option          | Effect                                      |
| --------------- | ------------------------------------------- |
| `--json`        | Emit a machine-readable record on stdout    |
| `--root <path>` | Board root, defaulting to the main worktree |

The record carries `location`, one of `unstated`, `live`, `archived`, or `outside`, and `citedBy`, the other live tasks whose `Plan:` line lands on the same file. Exit codes: `0` read, `1` refused with `no-board` or `no-match`.

The target resolves against the board folder and against the project root both, so `../plans/x.md` and `.canon/plans/x.md` land on the same file and one plan two tasks spelled differently counts once. Containment is tested at both record roots rather than at the one this tree resolves at, since a line somebody wrote against a root the tree has since left is still a path into the plans folder, and reading it as outside would report a shipped plan as still live. `docs/agents/records.md` states the read order.

`canon tasks archive` decides its plan move on this same answer, so a caller wanting the count reads it here rather than scanning the board.

Branch on `reason` rather than on the exit code, which is the rule the archive section above already states and which this verb needs for a second reason. An operator's shell profile may wrap `canon` in a function that runs the binary and then another command and takes the second status, which masks every non-zero exit rather than only an absent verb. The binary exits 1 for an unknown subcommand and 1 for an ordinary refusal alike, so the record is the only signal that survives the wrapper.

A `live` location with an empty `citedBy` is the sweep to run. One whose `citedBy` names a sibling is a plan several tasks share, which the sweep leaves alone and the archive gate lets through.

```bash
canon tasks plan-citations v28.1-trigger-escalation --json | jq -r '.location' # canon-allow-reference: illustrates the stem-selection form, not a citation of a real task
```

## Plan answers

`canon tasks plan-answers <plan>` answers whether a plan is launchable, which is whether it still waits on the operator for a call only they can make. It reports and never writes.

Name the plan by its path or by its slug, which resolve to the same file:

```bash
canon tasks plan-answers dispatch-answer-gate
canon tasks plan-answers .canon/plans/feature-dispatch-answer-gate.md
canon tasks plan-answers ../plans/feature-dispatch-answer-gate.md
```

A relative path resolves against the project root first and against `.canon/tasks/` second. The third form above is what a board row writes, since its link is relative to the board, and a dispatcher copying the reference out of the row it is dispatching has that spelling to hand rather than either of the other two. A refusal names every base it looked under.

`canon tasks plan-citations` reads a task's `Plan:` line against those same two bases in the opposite order, and tests that the target lands under the live plans folder, which this verb does not. Both answer the same file for every spelling a board writes. Liveness is a separate refusal here: a plan resolving inside `.canon/plans/archive/` returns `archived` rather than a launchable reading, since it answers every question and describes work that already shipped.

A plan still staging its batches with a `**Batch N**` sub-heading inside one file's `**Files to touch:**` reads `launchable: false` the same way, alongside the operator-call case. It reports as an entry in `open` labeled `Batch staging`, stating that the plan must split into one file per batch before it can dispatch, since the row waits on a split rather than on the operator.

| Option          | Effect                                      |
| --------------- | ------------------------------------------- |
| `--json`        | Emit a machine-readable record on stdout    |
| `--root <path>` | Board root, defaulting to the main worktree |

The record carries `launchable` and `open`, the questions still waiting, each with the `label` that names it and the `why` its suggestion gave for needing a person. Exit codes: `0` launchable, `1` refused with `no-plan`, `archived`, or `bad-input`, `2` waiting on the operator.

A blank `- Answer:` is not a waiting question. The plan standard fixes an empty slot as accepting the `- Suggested:` line above it, so the shapes this reads are `- Suggested: needs your call, <why>` and the two demonstrated paraphrases, `needs operator's call` and `needs the operator's call`, over an empty slot, which is what that standard writes where the answer turns on preference rather than on a technical default. A verb reading every blank slot as open would report every plan in the folder.

The question block is read through the same parser `canon tasks validate` runs, so the gate and the conformance check cannot drift into disagreeing about what a question is. A question carrying no suggestion at all is that check's finding rather than this one's, and it goes unread here.

Branch on `launchable` rather than on the exit code, for the reason the section above states: a shell profile wrapping `canon` in a function can take a later command's status and mask every non-zero exit, which reads a waiting plan as a launchable one.

The orchestrator dispatch runbook calls this before it checks the branch or the file sets, so a row whose plan still needs a person is handed back rather than launched into a worker that halts on the same question.

```bash
canon tasks plan-answers dispatch-answer-gate --json | jq -r '.launchable'
```

## Plan branch

`canon tasks plan-branch <plan>` derives the branch name from a plan file. It reports and never writes, and it names the plan the same two ways `canon tasks plan-answers` does, by path or by slug, against the same two bases.

```bash
canon tasks plan-branch dispatch-answer-gate
canon tasks plan-branch .canon/plans/feature-dispatch-answer-gate.md --json
```

| Option          | Effect                                      |
| --------------- | ------------------------------------------- |
| `--json`        | Emit a machine-readable record on stdout    |
| `--root <path>` | Board root, defaulting to the main worktree |

The record carries `type`, `slug`, `branch`, `words`, and `conforms`. Exit codes: `0` derived and conforming, `1` refused with `no-plan`, `archived`, or `bad-input`, `2` derived with `conforms` false. Branch on `conforms` rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

`slug` is the plan filename with its `feature-` prefix and its extension taken off, and `type` is the constant `feat`. Reading a type off the plan's prose was the alternative, and it is the half of the derivation that has already disagreed with itself: one dispatch checked `fix/path-form-hook` against a worker that took `feat/path-form-hook`, both sides reading one plan. What makes the constant safe is that a branch type is cosmetic. `git-stage` reads a commit's type off the staged diff and `git-pr` reads a title off the diff, so the semantics a release reads never pass through the branch name. What it costs is a worktree listing where every plan-derived branch reads `feat/`, and nothing renames it later.

`conforms` reads both caps `standards/branch.md` states, being 4 words on the description and 50 characters on the whole branch. A false reading is a row for a person rather than a name to shorten here, since a rename parts the branch slug from the plan slug that `session-worktree` tier 1 and `git-pr`'s plan lookup both read back.

Both sides of a dispatch call it. The orchestrator's collision check derives its candidate here, and `auto-ship` Step 0 derives the worktree it enters from the same plan, so the branch a gate clears and the branch a session takes are one string by construction. They were two readings of one paragraph until 2026-09-06, when four dispatches on one plan produced three different strings.

```bash
canon tasks plan-branch dispatch-answer-gate --json | jq -r '.branch'
```

## Plan reach

`canon tasks plan-reach <plan>` reads a branch back against what was written down about it. It reports and never writes, and it names the plan the same two ways `canon tasks plan-branch` does.

```bash
canon tasks plan-reach dispatch-answer-gate
canon tasks plan-reach dispatch-answer-gate --base origin/main --json
```

| Option          | Effect                                         |
| --------------- | ---------------------------------------------- |
| `--base <ref>`  | Far side of the range, defaulting to the trunk |
| `--json`        | Emit a machine-readable record on stdout       |
| `--root <path>` | Board root, defaulting to the main worktree    |

The record carries `claimed`, `undeclared`, `declared`, `base`, `changed`, `plans`, `rows`, and `board`. Exit codes: `0` read with nothing claimed, `1` refused with `no-plan`, `archived`, `bad-input`, `no-base`, or `no-diff`, `2` read with a claim standing. Branch on the record rather than on the exit code, which a shell function wrapping `canon` can flatten to zero.

`claimed` leads because it is the short list and the one worth acting on. It carries one entry per path, each holding a `holders` list, so a track carrying both a live plan and a `## Run now` row reads as one holder rather than two. A holder names itself, its `source` of `plan` or `row`, and the `declaration` it matched on, so a folder claim reports which folder rather than leaving the reader to find it. A plan holder also carries `rowed`, whether that plan has a row in `## Run now` at all: a plan with no row is the shape a plan nobody archived takes, and equally the shape of one whose task has yet to be dispatched, so it narrows the reader's search rather than answering it. `undeclared` is every changed path this plan never named, which runs long on an ordinary branch: over the wave this verb was filed against, it ran 22 of 26 paths on one pull request and 18 of 25 on another. Those are the ship chain's own writes rather than scope creep, since the sync skills reach a context entry and the public docs, and the check stages regenerate what they assert.

A declaration is a backticked span standing as an entry's subject, ahead of the colon opening its reason. Reading every span was the alternative and it reports pairs that were never going to collide, since a reason routinely cites a file the entry is not about: measured over the same wave, the subject rule reports 6 crossing pairs against 14 for every span. Both sides of a rename declare, since both sit ahead of the colon.

The range is read at the current directory and the plans and board at the board root, so a linked worktree reads its own branch against the shared records. Reading both at one root was the alternative and it measures a main checkout sitting on the trunk, where the range closes on itself and every branch reports a reach of nothing.

It reads only what is written down, so it inherits the dispatch runbook's blindness: a hand-launched track carries no row and a track with no plan carries no declaration. The `plans`, `rows`, and `board` fields say how much there was to compare against, so a clear reading over an empty corpus does not read as a proof. A missing board reports `board: false` and zero rows rather than refusing, since a project with plans and no board still has a branch worth reading.

A claim is only as current as the folder it was read from, and the live folder holds a plan whose work already shipped until something archives it. `canon tasks archive` moves a plan on merge, so a plan stranded by a run that never reached the archive keeps claiming its files against every branch afterwards. Check whether the holder is actually in flight before treating a claim as a collision: the first run of this verb on its own branch reported five paths held by a plan whose verb had already merged, and the whole reading came of a file nobody archived. `canon tasks validate` is what reports the stranded plan itself.

`canon:git-ship` runs it at step 5, after `git add -A` and before the commit grouping. That is the first point the branch is whole and the last before a pull request exists to carry the answer.

```bash
canon tasks plan-reach dispatch-answer-gate --json | jq -r '.claimed[] | "\(.path) held by \([.holders[].name] | join(", "))"'
```

## Plan link

`canon tasks plan-link <task> <plan>` writes or corrects a task's `Plan:` line, as `Plan: [<label>](<target>)` right after the H1. `plan-feature` calls it right after a plan file lands, when Step 1 resolved an existing task for the feature, so the line is a mechanical write rather than hand-edited markdown.

Name the task by its filename stem, and the plan by its path or its slug, the same two forms `canon tasks plan-answers` accepts:

```bash
canon tasks plan-link v28.1-trigger-escalation dispatch-answer-gate # canon-allow-reference: illustrates the stem-selection form, not a citation of a real task
canon tasks plan-link v28.1-trigger-escalation .canon/plans/feature-dispatch-answer-gate.md --json
```

| Option          | Behavior                                    |
| --------------- | ------------------------------------------- |
| `--json`        | Emit a machine-readable record on stdout    |
| `--root <path>` | Board root, defaulting to the main worktree |

The plan resolves the same way `canon tasks plan-answers` resolves one, against the project root first and `.canon/tasks/` second, so a bare slug and a board-relative path both work. A reference resolving to no file refuses as `no-plan`, naming every base it looked under.

The write mirrors `canon tasks pull-request`'s add/correct/unchanged shape, anchored on the H1 rather than on the last origin line, since `Plan:` is the first origin line a task carries rather than the last. The `action` field reports `added`, `corrected`, or `unchanged`, which makes a rerun against the same plan safe.

Exit codes: `0` recorded, `1` refused. The `reason` field carries `no-board`, `no-match`, `no-plan`, or `bad-input`.

## Pull request

`canon tasks pull-request` records the number a branch's pull request carries onto the task that branch closes. It adds `Pull request: #NNN` under the `Plan:`, `Groundwork:`, `Intake:`, or `Issue:` lines the task already holds, and corrects the number in place when the line exists.

Name the task by its filename stem, or by the plan its `Plan:` line points at:

```bash
canon tasks pull-request 673 v28.1-trigger-escalation # canon-allow-reference: illustrates the stem-selection form, not a citation of a real task
canon tasks pull-request 673 --plan worktree-scratch-routing --json
```

| Option          | Behavior                                           |
| --------------- | -------------------------------------------------- |
| `--plan <slug>` | Select the task whose `Plan:` line names this plan |
| `--json`        | Emit a machine-readable record on stdout           |
| `--root <path>` | Board root, defaulting to the main worktree        |

A plan is matched on the token both spellings share, so `worktree-scratch-routing`, `feature-worktree-scratch-routing`, and `.canon/plans/feature-worktree-scratch-routing.md` all select the same task. The `action` field reports `added`, `corrected`, or `unchanged`, which makes a rerun against the same number safe.

Exit codes: `0` recorded, `1` refused. The `reason` field carries `no-board`, `no-match`, or `ambiguous`. `git-pr` skips silently on those three, because each is a case where a guessed write would archive the wrong task once the branch merges.

A malformed argument refuses as `bad-input` instead, which sits outside that set on purpose. `git-pr` derives the number by slicing whatever `gh pr create` printed, so a non-numeric value is reachable, and folding it into the swallowed set would lose the number with nothing reporting it.

## Outcome

`canon tasks outcome` marks outcomes `[x]` on a task by their position in its outcome list, counting every checkbox in file order from 1.

```bash
canon tasks outcome v28.1-trigger-escalation --close 1 --close 3 # canon-allow-reference: illustrates the stem-selection form, not a citation of a real task
canon tasks outcome --plan worktree-scratch-routing --close 2 --json
```

| Option               | Behavior                                           |
| -------------------- | -------------------------------------------------- |
| `--close <position>` | Outcome to mark `[x]`, 1-based, repeatable         |
| `--plan <slug>`      | Select the task whose `Plan:` line names this plan |
| `--json`             | Emit a machine-readable record on stdout           |
| `--root <path>`      | Board root, defaulting to the main worktree        |

An outcome already closed comes back under `alreadyClosed` rather than refusing, so a rerun against the same positions changes nothing. A position past the end of the list refuses as `out-of-range`, since a caller counting wrong should hear about it rather than mark a neighbor.

Positions skip fenced blocks. A checkbox inside a sample a task displays is not an outcome the task claims, and counting one would shift every position after it. `canon tasks archive` reads the list through the same walker, so the two verbs cannot disagree about which checkboxes are outcomes.

Exit codes: `0` closed, `1` refused. The `reason` field adds `no-outcomes`, `out-of-range`, and `bad-input` to the three above.

Both verbs exist because the write is an edit inside a file that already exists. `Edit` and `Write` refuse a main-root path from a linked worktree, and a shell stream editor is banned for in-place edits, so a verb resolving the board root in-process is the only route a skill body has. Creating a whole file needs no verb, because a heredoc through `Bash` writes it safely.

## Validate

`canon tasks validate` reports what each row of `priority.md` claims against what the tree holds. It reads and never writes, because a row is a session's claim about readiness and a validator that repaired one would be asserting the claim it exists to test.

```bash
canon tasks validate
canon tasks validate --json
```

Seven checks run. Plan and Collisions reach one half each of the `## Run now` test the board standard states. Mapping and Grouping test the folder contract and hold for every group, and Shape holds for every group too, ahead of the four. Ordering reaches only the `## Needs a plan` rows, and Blockers reaches every row outside `## Run now`:

| Check      | What it reports                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| Shape      | A row whose cell count disagrees with its table's header, or one stranded behind a table a blank line already closed    |
| Plan       | A `## Run now` row whose Plan column carries no link, resolves to no file, or disagrees with the task's own line        |
| Mapping    | A row or backlog line naming no task file                                                                               |
| Grouping   | A task carrying a row in more than one readiness group, or on both surfaces                                             |
| Ordering   | A `## Needs a plan` row whose stated position disagrees with where it actually sits, or which states no position at all |
| Collisions | Two `## Run now` rows whose Touches columns name a path in common                                                       |
| Blockers   | A parked row whose blocker has stopped holding, whose cited task resolves nowhere, or whose cited task was declined     |

Shape runs before any other check reads a row, since a row failing it carries no dependable fields for the rest to check. A blank or prose line closes the table above it, so the walk treats the next pipe line as a fresh header candidate rather than as a continuation. That candidate counts as a header only when the line behind it is a separator carrying the same cell count, and one that fails is `row-untabled`, stranded behind a table that already closed. Cell count still has to match the header on every row that clears that test, and a row whose count disagrees is `row-misshapen`, the shape a dropped pipe or a merged column produces.

The Plan check reads the row and the task file both, because the two are written by different hands and only the task's own `Plan:` line reaches the archive. A row carrying a plan whose task states none is `plan-uncited`, and a pair naming two different plans is `plan-mismatched`. Both sides resolve against the board and against the project root before they compare, so a row writing `../plans/x.md` and a task writing `.canon/plans/x.md` name one file rather than two.

Mapping spans two surfaces, because a task sits on `priority.md` when it would plausibly be planned soon and on `backlog.md` otherwise. A row or a backlog line naming no task file is `task-unresolved`, and a file both surfaces name is `row-duplicated` for the reason a task in two groups is: it claims two things about itself and only one can hold. A task file neither surface names is `unplaced` rather than a finding, since that is the normal state between a session filing it and a live orchestrator placing it on the board. One check across both is what lets a task move between them without the move reading as a dropped file.

A backlog line is a bullet carrying a link to a sibling task, since the backlog is a flat unordered list rather than a table. A bullet holding prose is skipped rather than reported, which keeps the file's own intro out of the findings, and the task that bullet meant to name still lands in the `unplaced` array below rather than the findings. A project carrying no `backlog.md` reads as an empty backlog rather than a refusal, which leaves the one-to-one mapping this check ran before the second surface existed.

Ordering reads a `## Needs a plan` row's `Waiting on` cell for the position it claims, and reports two failures off one walk. A row stating an ordinal is checked against where it actually sits, which is `row-misordered`. A row claiming no position in either form it may take is `row-unranked`, since its cell argues the task matters and ranks it against nothing, which leaves the order recording when each row was filed.

The ordinal phrase is prose rather than data, searched for anywhere in the cell rather than at its start, since every live row states its position at the end of a sentence rather than at the front. The vocabulary stops at `first` through `twentieth` plus `last`, since a parser strict enough to catch a gap would otherwise flag a row phrased correctly and differently, and bounding it to those words is what keeps a cell reading `Untestable from here` from matching on `from`. One comparison against the real position catches a gap, a duplicate, and a sequence starting somewhere other than first alike.

The comparative phrase is bounded the same way and for the same reason. A closed verb list of `leads`, `heads`, `opens`, `closes`, `trails`, `precedes`, `follows`, `outranks`, and `sits under`, `above`, or `below` has to sit in one clause with a positional object, which is a `vNN.N` phase label, the word `group`, or `row` or `rows`. Both halves are needed, since a cell reading `it closes a gap the reference gate leaves open` carries the verb and claims no position, and the clause bound is what stops a verb in one half of the cell pairing with an object in the other. An ordinal exempts the row, being a comparative claim already. The residue runs both ways: a cell phrased comparatively and unusually reports as unranked, which is the false negative and the safe direction for a check over prose, and a vocabulary verb reaching a positional object non-positionally reports as ranked, which is the false positive. Separating the second from a real position claim means grading prose, so the bound stays where it is.

The collision check is the one a person cannot run by eye. Paths come from the backticked spans in the Touches column, a span naming no file is dropped, and a directory collides with any file beneath it. A `## Run now` row whose column parses to nothing is reported rather than skipped, since a row stating no file set makes a claim nothing can check.

Where a directory holds the other row's file, the finding names the row that claimed it, reading `both touch src/tasks, which v2.0-second claims as a folder.` The shared strings alone leave an over-broad cell and a genuine overlap identical, which is how a correct report was once read as the verb comparing folders rather than files. <!-- canon-allow-reference: illustrates the finding's own sentence shape, not a citation of a real task -->

The blocker check re-takes a measurement the board records once and never repeats. Two of the five blocker kinds put a fact on disk: a dependency is settled by the cited task being archived or by its work reaching the trunk, and a collision is settled by nothing under `## Run now` still holding the file the cell cites. A cited task resolving under `.canon/tasks/declined/` instead reports separately as `blocker-declined`, since a decided-against task is neither the shipped work `blocker-settled` reports nor the dangling pointer `blocker-unresolved` reports.

```json
{
  "findings": [
    {
      "kind": "blocker-declined",
      "group": "Up next",
      "subject": "v50.6-a-standard-no-skill-reads", // canon-allow-reference: shows the subject field's real vXX.Y-slug shape, not a citation of a real task
      "message": "waits on v9.0-superseded, which was declined." // canon-allow-reference: illustrates the finding's own sentence shape, not a citation of a real task
    }
  ]
}
```

A closed outcome is not the fact the dependency half needs. The ship chain marks outcomes as its first step and opens the pull request several steps later, so a check reading the checkbox reports the row settled while the branch is still in review. A live task therefore settles the row only once it closed every outcome and carries a `Pull request:` line the trunk holds. One that names no pull request, and one whose number no trunk ref could answer for, land in the untested array below rather than being settled or left silent.

The trunk is read as the clone already holds it, `origin/main` first and local `main` behind it, and no run fetches. A validate runs several times a sweep and a fetch per run is a cost this command does not carry, so a clone behind its remote under-reports rather than claiming work landed.

Both halves gate on a citation inside the `Waiting on` cell, never on the columns beside it. The board format gives a collision cell the file held by the running task, so a row whose cell names no file was parked by something else, and testing its Touches column instead reports a cleared collision on a row no collision ever parked while counting that row as re-tested. A cited task is a bare sibling link, the way the Task column spells one, so a pointer into another folder names a plan rather than a task and settles nothing. A cited task carrying no outcome box settles nothing either, since a file the check could not parse is not evidence of a finished one.

A citation resolving in none of the board, the archive, or the declined folder is `blocker-unresolved` rather than a settled row. Reading an absent file as archived or declined states a specific fact about a file nobody ever wrote, which is what a renamed task or a typo produces, and only a task that genuinely closed or was genuinely declined releases the row waiting on it.

The other three kinds rest on a person's judgment, so a row neither half reached lands in a second array rather than in the findings:

```json
{
  "untested": [
    {
      "group": "Needs a plan",
      "subject": "v50.6-a-standard-no-skill-reads", // canon-allow-reference: shows the subject field's real vXX.Y-slug shape, not a citation of a real task
      "message": "..."
    }
  ]
}
```

An untested row is not a finding and moves no exit code. Reading a clean findings list as a clean board is the failure the array exists to prevent, and `orchestrator-parked.md` is the pass that takes those rows by hand.

A `## Run now` row whose Touches column names a bare folder lands in a third array on the same reasoning:

```json
{
  "claims": [
    {
      "group": "Run now",
      "subject": "v1.0-first", // canon-allow-reference: shows the subject field's real vXX.Y-slug shape, not a citation of a real task
      "message": "claims the whole src/tasks folder, so it collides with every row written under it."
    }
  ]
}
```

That claim collides with every row a later session writes under the folder, and it is legitimate whenever the row does rewrite the directory, so the array states the reach and moves no exit code. A measure failing on a cell that is right teaches a reader to skip it. Folder against file is decided by asking the tree for a path that resolves, and by the extension only for a path the row has yet to create, since the name alone reads a file carrying no extension as a folder.

The scan reaches `## Run now` and stops, where the collision check stops. A cell in another group describes work nobody has planned, written as a sentence and rewritten once a plan exists, so a claim read off one reports on prose rather than on a file set. A parked folder claim surfaces when its row is promoted, which is when the cell becomes something a dispatcher can act on.

A task file neither surface names lands in a fourth array, on the same reasoning:

```json
{
  "unplaced": [
    {
      "subject": "v50.6-a-standard-no-skill-reads", // canon-allow-reference: shows the subject field's real vXX.Y-slug shape, not a citation of a real task
      "message": "is a task file with no row on the board and no line on the backlog."
    }
  ]
}
```

Under the roster-checked hand-off `task-board` and `plan-groundwork` state, filing a task and placing its row are two acts a different session each may take, so a task caught between the two is ordinary rather than a finding and this array moves no exit code. It still reports, since it is the only local detector for a row a hand-edit dropped, a handoff message that never arrived, or an orchestrator that ended before placing it.

Exit codes: `0` every check passed, `1` refused, `2` at least one finding. The `reason` field carries which gate refused: `no-board`, `no-ordering`, or `no-groups`. A board grouping under headings of its own trips `no-groups` rather than being read against columns it never declared.

Columns are read from each table's own header rather than by position, so a project whose board differs from this one is reported for what it lacks. The `index`, `priority`, and `backlog` siblings are skipped, along with every pre-compaction handoff, which takes one file per session under a `session-` prefix. None of them is a task, and a handoff counted as one would be reported as a task carrying no row on every session that wrote one.

Skills branch on the findings rather than on the exit code:

```bash
canon tasks validate --json | jq -r '.findings[] | "\(.kind): \(.subject)"'
```

For the board format, the `Pull request:` line, and the archive rules, see `standards/tasks.md`.
