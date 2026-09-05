---
title: AI workflow
description: Overarching AI workflow across domains
category: Agent surface
---

# AI workflow reference

A concise reference for when to reach for which tool, organized by what you're trying to do.

> **Mental model:** Claude Code for everything: planning, implementation, review, docs, git, and release.

## Documents

Project docs split across two roots at the project root, on one mechanical line: what is committed lives in `.claude/`, and every gitignored session record lives in `.canon/`, which a single ignore entry covers.

```plaintext
.claude/
├── REQUIREMENTS.md  ← goals, non-goals, MVP scope
├── ARCHITECTURE.md  ← technical design decisions
├── DESIGN.md        ← visual intent and token decisions (UI projects)
├── WIREFRAMES.md    ← ASCII wireframes: layout, UI copy, and interaction rules (UI projects)
├── context/         ← per-domain narrative loaded on demand via index.md
└── rules/           ← path-scoped governance rules, written by canon gov install

.canon/
├── diagrams/        ← one Mermaid entry per diagram kind with a generated index.md, redrawn on demand
├── tasks/           ← one file per task with a generated index.md, local scratch
├── plans/           ← one plan per feature, archived inside itself once it ships
├── memory/          ← durable session facts no context entry owns
└── tmp/             ← deletable scratch, safe to remove without loss
```

A project scaffolded before the move keeps its records under `.claude/`, and every command reads either root. `canon migrate records` moves one project across and repoints what cites it, and `canon migrate record-tree` follows it to reach the citations inside the records themselves, which the first verb passes over because it enumerates through git.

Three tiers of context load with different cost: always-loaded (root `CLAUDE.md`, `.claude/REQUIREMENTS.md`, `.claude/ARCHITECTURE.md`), path-scoped lazy (`.claude/rules/<scope>.md` with `paths:` glob), and on-demand lookup (`.claude/context/<domain>.md`, or `.claude/context/<domain>/` once a domain outgrows one file, discovered via `.claude/context/index.md`). See [the context model](../../.claude/context/context-model.md) for the full picture.

Run `canon init` to seed the `.claude/` directory, a root `CLAUDE.md` file, and `.claude/rules/` in one pass. `canon init` chains claude init and governance install. Claude Code auto-loads every file in `.claude/rules/` at session start, applying always-on rules unconditionally and path-scoped rules to files matching their `paths:` glob.

## Scenarios

### Bootstrap a new project

See [target projects](../target-projects.md) for the scaffold decision, core domains and skips, and the full lifecycle across scaffold, add-a-domain-later, and upstream sync.

### New feature

One session works for most features. Prefer splitting across two sessions only when the feature is large enough that you want a cold, independent reviewer on the diff. Plan and implement in session 1, then review and ship in session 2.

#### Session 1

Work in Claude Code directly. It reads `CLAUDE.md` automatically and has full file access, no pasting needed.

- When the input is a pile of findings rather than one feature, invoke `canon:claude-intake` first. It files the dump into `.canon/intake/<nn>-<slug>/`, one item per finding carrying a problem measured against the tree, a proposed fix, and a verdict, then names which items are plan-ready, which need measuring, and which are already settled.
- When the current state is unmeasured and more than one approach is live, invoke `canon:claude-groundwork` first. It opens a track folder under `.canon/groundwork/<nn>-<slug>/` and ends in a decision, which may be to do nothing. Skip it when the approach is already settled.
- Invoke `canon:claude-feature` to scan for code-level conflicts and ambiguities, confirm approach before proceeding
- Implement the feature, then Claude Code runs the commands defined in `CLAUDE.md`, fixes failures, and iterates until all pass
- For UI changes, invoke `canon:claude-ui-test` to generate and run Playwright e2e tests
  End the session once the feature works and tests pass. Invoke `canon:claude-docs` to capture any decisions made during implementation before closing.

The routing test is whether the repository can answer an item today. A session grepping handles the yes, and a groundwork track handles the no.

A groundwork track may run experiments to settle a question, writing a fixture it reads itself under `.canon/tmp/groundwork-fixtures/<slug>/` and spawning up to three billed headless runs before it asks. A fixture a headless run is pointed at sits outside the repository, since a session started under the project root inherits that project's `CLAUDE.md` and rules and would measure them instead of the arm.

What a spike produces goes somewhere else again. An input the run reads is re-runnable and cited by nothing, so the scratch path above is the right lifetime for it, while a recording or a render the track cites as evidence for a finding is what a later reader opens to check the claim. Evidence therefore lives in `evidence/` inside the track beside the file citing it, since the scratch tree holds only what can be deleted without loss.

#### Session 2

Start a fresh Claude Code session. The diff is sufficient context for both review and ship.

- Invoke `canon:claude-review` to review all changes since main and output a findings report
- Fix any valid findings
- Invoke `canon:git-ship` to run the project's verify commands, sync docs, commit by concern, rename branch, and open PR

### Parallel features

When features are independent, run them in parallel instead of sequentially. Use one git worktree per feature so each session has its own working tree and branch.

- Create a worktree per feature, then start a Claude Code session in each
- Invoke `canon:claude-feature` in each session. Plans land at the main worktree root as `.canon/plans/feature-<slug>.md`, one per feature, no collisions. Small features stay in chat and skip the file.
- Implement, verify, and review each feature independently. `claude-review` writes a per-branch report at the main worktree root (`review/branch/review-<slug>.md`), and `claude-ui-test` writes a per-branch checklist handoff there too (`tmp/ui-checklist/<slug>.md`) that `git-pr` posts to the pull request and removes, so parallel sessions do not overwrite each other. The slug is the branch name with any leading type segment dropped, so `feat/jwt-expiration` and the plan at `feature-jwt-expiration.md` meet on one name
- Ship each worktree separately with `canon:git-ship`
- For full autonomy per worktree, invoke `canon:claude-autoship` instead of the manual chain. Approve the plan, walk away, come back to a pull request the chain marked as a draft and then read the flag back on. The mark says the work has had no review yet, and it holds no window, since readying a pull request to merge lifts it and is the operator's act.

To run several worktrees as a coordinated flow rather than ad hoc, assert the orchestrator role in one warm session with `canon:claude-orchestrate`. It holds the cross-feature call, plans each feature itself or dispatches a cold planner under `canon:claude-planner` to write the plan, refills the ready queue so a free worker never waits, and reviews each worker's PR with `canon:claude-pr-review`, then tells the session holding that branch to run `canon:claude-address-review` whenever the pass posted a finding at any severity, which is the same threshold `canon:claude-pr-review` states and posts its open heading under. The human launches workers and merges. See [operating model](operating-model.md) for the full loop.

Execution order comes off `.canon/tasks/priority.md` and nothing sequences work into versions. Scope stays in `.claude/REQUIREMENTS.md` as a statement of what is wanted, and it reaches the board as discrete tasks the orchestrator orders by readiness.

Run one orchestrator at a time. The board is gitignored, so a second session reads none of the first one's writes and the two collide on labels and archives.

No fixed number caps the worker tracks underneath it. Collision between file sets is what binds, so a candidate opens only when its files are disjoint from every track in flight, compared at the file path rather than at a folder above it, and the ceiling in practice is how many outputs one session can still review properly. Disjointness is necessary and not sufficient, since two tracks interact in ways no file-set comparison reads, so a stated reason can still hold a disjoint candidate behind another. An operator caps a session's workers by saying so, and that cap binds for the session rather than standing as a number in a file.

Before a handoff, the orchestrator checks the plan against the tree rather than reading it: grep each construct it names and count the sites, confirm every phase label it cites is still open, and open each file it describes. A plan goes stale from whatever merged after it was written, and reading cannot catch that.

A constraint naming a track in flight carries the same problem past the handoff, so the block opens with the commit it was measured against. A worker re-tests before honoring one, fetching and then logging that commit against `origin/main` over the paths the constraint names, and any merge there means the track landed and the constraint is dead. An unstamped block reads as unverified rather than as live, which covers every plan written before the rule.

`.canon/plans/`, `.canon/review/`, and `.canon/memory/` all resolve at the main worktree root, so artifacts created in any session are visible from any sibling worktree. A session inside a worktree reads them directly, since the file-editing tools refuse a main-root path but `Read` resolves normally. It writes a whole file through the shell and makes a change inside an existing file through a `canon` verb, which resolves the main root in-process. See [Claude Code and git worktrees](../../wiki/claude/claude-worktrees.md) for the full rule and the domain-level fan-out guidance.

The plan's shape is fixed by `standards/plan.md`: the section list, the filename, the lifecycle, and the contract its questions keep. Every question carries a `- Suggested:` line and an empty `- Answer:` slot, and a blank answer accepts the suggestion at execution time. That default is what makes a plan decision-ready in one pass, and it is the opposite of the contract an intake folder keeps, where an empty slot means nobody reached the item.

An execution that picks other than the suggestion rewrites the `- Suggested:` line as `overridden at execution to <pick>,` followed by the measurement that moved it, and leaves the slot blank. That fixed phrase is how a reader of the archived plan tells an override from a suggestion the execution accepted, since an authored suggestion often carries a number of its own. The same deviation takes one line in the open task's `## Findings`, which is the register that survives the plan being archived. A deviation from a question somebody already answered goes back to whoever answered it instead, since a filled slot is a decision already made.

`canon records validate plans` reports where a plan and that standard disagree: a filename that is not `feature-<slug>.md`, a missing required section, a files-to-touch entry naming no file, and a question carrying a suggestion with no answer slot. The same verb takes `groundwork`, `intake`, `memory`, and `teach`, which are governed the same way and were unreachable for the same reason. Nothing fires it automatically, because all five folders are gitignored and every check the repository runs reads changed files from git. It reports and never writes, since the folders are per-machine scratch with no history to recover a wrong repair from.

`canon records push` carries these folders off the disk they live on, and `canon records pull` brings them back. Nine of them are backed: `diagrams`, `groundwork`, `intake`, `memory`, `plans`, `proposals`, `review`, `tasks`, and `teach`, each carrying whatever it has archived inside it. The history lives in a second git directory at `.canon/.records.git` with `.canon/` as its work tree, so every path a task file cites stays where it is.

A person points it at a private repository once and both verbs refuse until they have, and `push` refuses when that origin is also a remote of the project, since the payload is the memory pen and the groundwork trails. `.husky/post-merge` runs the push after its archive loop, on every merge rather than only on one that closed a task. See [records](../agents/records.md) for the refusal table.

`canon records size` reports what each of these folders holds, heaviest first, along with `.canon/tmp`. Each row carries the file count, the bytes, how many files were written in the last 7 and 30 days, and the dates of the least and most recently written one. Nothing fails on a number, because a record folder has no correct size. What the verb replaces is a reading somebody had to remember to take: the memory pen went from 44 entries to 236 between two counts made by hand a fortnight apart, and nothing reported the rate in between.

A plan that ships is archived, never deleted. `canon tasks archive` moves it to `.canon/plans/archive/` alongside the task it belonged to and retargets that task's `Plan:` line at the new location, so a completed task still leads to the reasoning behind it. An archive sits inside the record folder it archives rather than beside it, so one ignore entry and one backed-folder entry cover a record and everything it has retired. The folder is gitignored, which is why a deleted plan had no recovery path. A plan cited by more than one task stays put until the last of them closes, since moving it early would strand every other pointer.

A branch review report takes the other route and is swept rather than archived. `claude-review` writes it to `.canon/review/branch/`, the session addressing it reads it once, and the durable record of what a review found is the comment `claude-pr-review` posts on the pull request, so `claude-docs` deletes any report whose branch is gone. The body that writes a report owns how long it lives, which leaves the shipping branch's own report on disk through the run that cites it and collects it a branch later. What that loses is a local-only review on a branch that never opened a pull request, which is why the report says so where a reader meets it.

`canon:claude-docs` decides which task closed by reading the diff rather than the conversation. It resolves a merge base against `origin/main`, unions the committed diff with the working tree and untracked files, then matches unchecked outcomes on the board against what shipped. A task that shipped without ever being discussed still gets marked. Requirements, architecture, and design stay session-sourced, because a diff cannot carry a judgment.

`.canon/tasks/` is gitignored and resolves at the main worktree root, so every session shares one board. One file per task is what keeps concurrent sessions from overwriting each other, since a gitignored board has no history to recover a lost write from. Its `index.md` is generated by a hook rather than by `bun run check`, because the whole-repo index walk skips gitignored folders.

`.canon/memory/` carries the same arrangement, its own hook regenerating `index.md` from each entry's `title`, `description`, and `category`. A hand-maintained `priority.md` sits beside it carrying execution order and what each task is waiting on, which the alphabetical index cannot express.

`canon tasks validate` reads a row against its own table before it reads anything the row claims. A blank or prose line closes the table above it, so a row stranded there is checked against the line behind it rather than parsed as a continuation, and a row that clears that test still has its cell count checked against its header. A `## Needs a plan` row that states its own position, searched for `<ordinal> here` or the bare word `last` anywhere in the cell rather than at its start, is checked against where it actually sits, which is what catches a gap, a duplicate, and a sequence starting somewhere other than first alike.

Past that shape, it checks what a surviving row claims against what the tree holds: every plan pointer resolves, every task file is named by a board row or a backlog line and never by both, no task sits in two groups, and no two rows marked ready touch the same file. One check across both surfaces is what lets a task move between the board and the backlog without the move reading as a dropped file. The collision check is the half a reader cannot run by eye, and it is what keeps two workers from being handed colliding work. Blockers re-takes what a parked row waits on, reporting one whose cited task reached the trunk and one whose cited file nothing running still holds. A cited task settles the row by being archived, or by closing every outcome and naming a pull request the trunk carries, since the checkbox alone is marked while the branch is still in review. Both halves read a citation out of the blocker cell, so a row citing neither is reported as untested rather than counted clean, and so is a cited task the trunk could not answer for. It reports and never writes, because a row is the orchestrator's claim and a validator repairing one would assert the claim it exists to test. Nothing fires it automatically, since the board is gitignored per-machine scratch with no shared moment to hang a hook on, so the orchestrator's sweep calls it at the point the readiness claim is made and follows it with the parked re-test.

`canon:claude-tasks` owns the two operations that bracket a task's life. It creates the file, holding the filename convention and the frontmatter contract so a malformed write cannot break the index for every sibling, and it moves a shipped task to `.canon/tasks/archive/`. Creation is where the origin invariant is enforced: every task names a plan, a groundwork folder, an intake folder, or an issue, since a task with no origin is either lost context or work nobody decided to do.

Archiving a task carries its plan with it, in the same act. The merge is what settles a plan, and the hook below reaches the archive with nobody watching, so a second call after it would be a second failure point leaving the task archived and the plan live. A task whose plan a sibling still cites archives on its own and leaves the plan live, since moving it on the first task to close strands every other pointer at a path that has gone.

Nothing chained that archive until the `post-merge` git hook landed. Every earlier step fires from `canon:claude-autoship` or `canon:git-ship`, both of which finish while the pull request is still open, so a task archived there would close for work that may be abandoned. The board is gitignored, which rules out reading it from anywhere but the machine that pulled. The hook names the board's archive candidates and stays silent otherwise, including on a project with no board.

Candidates rather than closed tasks, because outcomes are marked on the branch. A task can read all `[x]` while its pull request is still open, so `canon:claude-tasks` confirms the work reached `main` before it moves anything, and the hook's own output says that check is still owed. A companion `post-rewrite` hook carries the same announcement for anyone pulling with rebase, which fires that event instead of `post-merge`.

It announces and moves nothing, so `canon:claude-tasks` stays the only writer. A shell-side archive would change a gitignored board with no diff to review and no session watching, and `index.md` regenerates from a session hook that a shell `mv` never fires. Both hooks ship with the `base` tooling stack, so a target project running this workflow gets the same trigger.

### Autonomous ship

For features on a mature stack, chain the post-plan pipeline in one session. Approve the plan, invoke `canon:claude-autoship`, and the skill runs implement → verify → review → ship sequentially.

- Use when the plan is tight and the stack has real verify commands and test coverage
- Autoship stops on: verify failure after one fix attempt, UI manual checklist non-empty, an inherited review finding above minor, no diff baseline resolving against `main`, an empty changed-file list, or hook failure
- Every stop leaves recoverable state. Fix and resume with `/git-ship`
- Skip autoship for auth, migrations, security-sensitive changes, or work where the plan itself is uncertain

#### What reaches review

Review findings split by origin before severity is read. One the branch inherited stops the chain, and one the run itself caused is repaired in place at any severity, bounded at a single pass. Origin is causation rather than authorship, so staleness the run induced in a file it never opened counts as its own and the plan's file list bounds what it builds rather than what it may repair.

Review is skipped when the diff is prose that only informs: every changed file matches `*.md` or `*.txt`, and none sits under a behavior path. Behavior paths cover skills and rules in both the authoring and the installed spelling, so the list matches whether a repository authors those surfaces or consumed them from the toolkit. Standards, snippets, `internal/`, and `tooling/` carry the authoring spelling alone, since none of the four reaches a session through a `.claude/` copy, and root `CLAUDE.md` is named as a file because a path prefix reaches nothing sitting in no folder.

Markdown under one states what an agent does, so a branch touching it reaches review while `docs/` and `wiki/` still skip and stay gated by `docs-sync`, `claude-standards-audit`, and pre-push hooks.

An empty changed-file list stops the chain rather than counting as prose-only. The filename test passes vacuously on an empty set, which routed a branch past review instead of through it.

`canon autoship classify` answers that decision now, and the chain branches on the record it returns rather than on a session applying the list above. Three runs read past the list while it was prose, the last of them a driven arm that staged a file the list names and shipped a draft pull request with no review. The verb takes the names the chain already computed, so no second diff baseline resolves, and it names the file and the test that decided. [Review classification](../agents/review-classification.md) carries the record shape and the exit codes.

The list stays written in the skill body as the fallback for a target whose installed CLI predates the verb, since the two ship at different speeds. That fallback is never a skip: failing open is the defect the verb closes, so an absent subcommand routes to review rather than past it.

#### Memory in the chain

`git-ship` runs its verify gate and then opens on `claude-memory-capture`, which sends what the session learned to the surface that owns it. `autoship` reaches the same step by invoking that skill at its Step 7 rather than restating the order. A fact about a domain carrying an entry in `.claude/context/index.md` is routed to that entry, and `claude-docs` folds it in on the next step, so it ships in the same pull request. Anything no entry owns stays a file in `.canon/memory/`.

Capture leads rather than trails because a routed fact edits a tracked file, which has to reach the branch before the commit steps run.

If capture wrote at least one memory file, `claude-memory-review` then proposes a decision-ready fix scoped to those entries while context is fresh, otherwise it is skipped. It stops at Propose. Review the receipt and run Apply yourself, on its own commit separate from the feature.

Run `claude-memory-review` standalone to curate the whole pen. An entry it retires moves to `.canon/tmp/memory-archive/` rather than being deleted, since the folder is gitignored and a bulk pass has no undo.

The receipt is collected once every item on it has been decided, and it survives untouched while any item is still pending. Whichever runs first takes it: Apply collects the receipt it has resolved, and `claude-docs` scans the folder on every shipped branch for one an earlier session left behind. Before the file goes, each declined item is folded into the entry it was about, since a promotion survives in its target and in git while a decline is recorded nowhere else. `canon standards memory` states what a fold writes and which entry types take one.

### UI polish

Verify the change manually in the browser. Invoke `canon:claude-ui-test` if you need e2e tests and a visual verification checklist for the session. For the fix itself, describe the change in Claude Code directly.

### Quick fix

- Verify failure or isolated bug → continue in Claude Code (it has the implementation context)
- Design or planning conflict → escalate to a new Claude chat session with the relevant plan context
- Fast file edit (a task file, config, renaming) → Claude Code directly, no chat needed

### Review

Invoke `canon:claude-review` at the start of session 2. It reads all changed files and outputs a findings report. Fix valid findings before invoking `canon:git-ship`. If nothing is valid, skip directly to ship.

### UI-heavy project

Before the first feature session on a UI-heavy project, pick a design tier. The tier determines seed shape, installed MCP servers, and installed plugin skills. See [visual design workflow](visual-design-workflow.md) for the framework and decision guide.

## Skills

Groups run in the order a project meets them, so a reader at a known point scans to that group and reads across. The set reconciles the scenarios above with the lifecycle [target projects](../target-projects.md) describes, rather than inventing a third vocabulary beside those two, so a group name matches neither source exactly and every moment either one names has a group. Each row says when to reach for the skill. What it does is the skill's own description.

This section is the corpus the coverage claim is measured against: every name `canon claude skills list --names` reports takes exactly one row here. A skill serving two moments sits at the earlier one, and mentions elsewhere in this file are prose rather than routing.

### Set up a project

| Skill                         | When to use                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `canon:setup-init`            | On a fresh scaffold, to detect the stack and run the whole install chain in one pass    |
| `canon:canon-operator`        | On a project that already exists, to read what it carries before an install is picked   |
| `canon:setup-gov`             | When the governance rules are wanted without the tooling chain                          |
| `canon:setup-indexes`         | When a markdown-heavy folder needs an `index.md` a session can browse                   |
| `canon:setup-plugins`         | On a new machine, to install the community and official plugins user-scoped             |
| `canon:setup-verify`          | After the agent generates configs, to run the installed scripts and report pass or fail |
| `canon:claude-design-extract` | Before the first UI feature, to draft `.claude/DESIGN.md`                               |
| `canon:claude-diagram`        | Once the architecture is written, to draft per-kind entries under `.canon/diagrams/`    |

### Decide what to build

| Skill                        | When to use                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `canon:claude-intake`        | When the input is a pile of findings rather than one feature                    |
| `canon:claude-intake-answer` | When an intake folder holds unread slots waiting on your decision               |
| `canon:claude-groundwork`    | When the state is unmeasured and more than one approach is live                 |
| `canon:decision-escalate`    | When open decisions turn on your preference and want batching into one set      |
| `canon:draft-and-pick`       | When the call is taste and wants several candidates rendered side by side       |
| `canon:claude-tasks`         | When a decided item needs a file on the board, or a shipped one needs archiving |
| `canon:claude-feature`       | When the approach is settled and the next step is a plan                        |

### Build the feature

| Skill                        | When to use                                                         |
| ---------------------------- | ------------------------------------------------------------------- |
| `canon:claude-worktree`      | At the plan-to-execute boundary, to get an isolated tree and branch |
| `canon:claude-autoship`      | After plan approval, to chain implement, verify, review, draft PR   |
| `canon:project-commands`     | When the project's own command needs running                        |
| `canon:systematic-debugging` | When a test fails or a bug surfaces, to force root cause first      |
| `canon:claude-ui-test`       | After a UI change, to generate e2e tests and a visual checklist     |

### Check the work before it leaves the branch

| Skill                           | When to use                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `canon:claude-review`           | On the local branch diff, before anything is pushed                                     |
| `canon:claude-standards-audit`  | When changed markdown has to answer to the authoring standards                          |
| `canon:claude-markdown-propose` | When a markdown claim needs rewriting and the change should wait for an answer per file |
| `canon:claude-ux-audit`         | To read UI source for missing states, edge cases, and inconsistencies                   |
| `canon:claude-ux-measure`       | To start the interface and measure paint, processor, and layout cost                    |

### Ship it

| Skill                         | When to use                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| `canon:git-ship`              | To run the whole post-feature chain from the verify gate through open PR              |
| `canon:claude-memory-capture` | First skill in that chain, to route what the session learned to the surface owning it |
| `canon:claude-docs`           | When decisions diverged from the plan, or a shipped task needs its outcomes marked    |
| `canon:docs-sync`             | When a change since main left `README.md` or `docs/` stale                            |
| `canon:git-stage`             | When the staged set spans several concerns and wants one commit each                  |
| `canon:git-commit`            | When the staged set is one concern, or was staged hunk by hand                        |
| `canon:git-branch`            | When a branch name needs generating or renaming to conventional form                  |
| `canon:git-pr`                | When a pull request needs a title and body written from the diff                      |
| `canon:claude-memory-review`  | After capture writes an entry, to propose where each one belongs                      |

### After the pull request opens

| Skill                         | When to use                                                          |
| ----------------------------- | -------------------------------------------------------------------- |
| `canon:claude-pr-review`      | From an independent session, to post findings on the PR itself       |
| `canon:claude-address-review` | On the worker's side, to fix posted findings and push a follow-up    |
| `canon:git-followup`          | For a small self-review edit on a branch whose PR is already open    |
| `canon:git-split`             | When a branch turns out to carry unrelated commits                   |
| `canon:git-issue`             | When something surfaced that belongs on the tracker rather than here |
| `canon:git-worktree`          | After a PR merges, to list worktrees and reclaim the slot            |

### Run several tracks at once

| Skill                      | When to use                                                                    |
| -------------------------- | ------------------------------------------------------------------------------ |
| `canon:claude-orchestrate` | To assert the control session that owns the queue and reviews each worker's PR |
| `canon:session-resume`     | At the start of a session, to pick up what a previous one left                 |
| `canon:session-map`        | At the close of a session, to write the handoff a compaction would destroy     |

### Keep the project current with the toolkit

| Skill                            | When to use                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `canon:claude-seed-sync`         | After a toolkit update, to reconcile installed seeds without losing customizations |
| `canon:migration-claude-md`      | When `CLAUDE.md` grew past what always-load context should carry                   |
| `canon:migration-context`        | When `docs/` holds agent-flavored files belonging in `.claude/context/`            |
| `canon:migration-superseded`     | When a drift report names a `.claude/` file a folder has replaced                  |
| `canon:migration-standards-drop` | When the project still holds an installed `.claude/standards/` tree                |
| `canon:canon-feedback-file`      | When something in the toolkit is broken, missing, or off                           |
| `canon:canon-feedback-triage`    | In the toolkit repo, to work through the open feedback issues                      |
| `canon:canon-rollout`            | In the toolkit repo, to take one change out to every consuming project at once     |

### Generate an artifact on demand

| Skill                      | When to use                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `canon:create-rule`        | For a project-specific governance rule the toolkit does not ship                                  |
| `canon:create-skill`       | For a new `SKILL.md`                                                                              |
| `canon:create-snippet`     | For a reusable prompt                                                                             |
| `canon:create-standard`    | For a new authoring convention                                                                    |
| `canon:docs-draft`         | For a brand-new `docs/*.md` page, drafted against `standards/docs.md`                             |
| `canon:context-draft`      | For a brand-new `.claude/context/<domain>.md` entry, drafted against `standards/context.md`       |
| `canon:wireframe-draft`    | For a brand-new `.claude/wireframes/<surface>.md` file, drafted against `standards/wireframes.md` |
| `canon:bash-script`        | For an interactive, human-facing shell tool                                                       |
| `canon:bash-cli-script`    | For a non-interactive automation, CI, or pipeline script                                          |
| `canon:ci-workflow`        | For a GitHub Actions workflow file                                                                |
| `canon:canon-slides-draft` | For a deck, drafted as `.claude/SLIDES.md` and rendered to PowerPoint                             |
| `canon:canon-screencast`   | For a recording script with beats and defaults already seeded                                     |

### Answer a question at any point

| Skill                       | When to use                                                                    |
| --------------------------- | ------------------------------------------------------------------------------ |
| `canon:canon-cli`           | Before a sync or install, to learn what it overwrites, merges, or leaves alone |
| `canon:youtube-transcripts` | When a video transcript is wanted in the repo as context                       |
| `canon:claude-teach`        | To learn a subject across sessions, in a workspace that holds the progress     |
| `canon:write-human`         | Before drafting or revising prose, for voice, rhythm, and density              |
| `canon:restate-plainly`     | When an answer or a document has to be read again in plain words               |

Every row answers a question rather than marking a point in a project's life, so a phase above would send a reader to the wrong group.

A learning workspace produces two halves and only one of them leaves. A lesson is worked through once and stays in the workspace, and a reference page or a glossary carries no learner, so it belongs wherever the project already keeps prose on that subject. Asking `canon:claude-teach` to promote sorts each durable page by who owns its subject, sending an outside subject to the wiki, an internal one to the matching context entry, and consumer-facing material to the public docs. It proposes and waits, because a promoted page is public prose that needs a line naming who owns the subject, and it writes nothing to a destination: each page the operator confirms goes to a handoff file that `canon:claude-docs` folds in from a branch. A project with no wiki folder gets a refusal naming `canon wiki init` rather than a folder it never asked for.

## Feedback routing

```plaintext
verify fails  → Session 1 (it has implementation context)
design fails  → new Claude chat session (planning problem)
review finds  → Session 2 (fix alongside review, before ship)
```

## Snippets

For the full list of snippets that complement this workflow, see `.claude/context/snippets.md`.
