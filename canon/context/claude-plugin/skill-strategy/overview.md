---
title: Overview
description: Where a plugin skill lives, the catalog command, the consumer map, the workflow against domain-knowledge split, the three entry points, and what a skill body carries
---

# Overview

## Overview

Plugin skills live in `claude/skills/` and are auto-discovered from the plugin root, whether that root is a marketplace install or a `--plugin-dir` pointed at a checkout. Folder presence is enough, with no registration. Each skill is a kebab-case folder containing `SKILL.md`.

This folder holds why a skill exists and where its boundary sits, which no listing recovers.

### Nested skills are not discovered

A skill at `skills/<category>/<name>/SKILL.md` is not discovered. This was measured on 2026-10-03 against Claude Code 2.1.288 with `--plugin-dir` only, so an installed marketplace copy is unmeasured. It takes no side on whether to nest skills.

- Fixture is a `plugin.json` with no `skills` key, `skills/flat/SKILL.md` as the control, and `skills/cat/deep/SKILL.md`
- Command, run from the fixture root, is `claude -p "/spike:deep" --plugin-dir "$F" --model sonnet --output-format stream-json --verbose --max-turns 3`
- The `init` event listed `spike:flat` and no `spike:deep`, and the reply said `/spike:deep` was not available

The control was listed in that same run, so the absence belongs to the nesting.

## Layout

Three locations own skills and the consumer map.

- `claude/skills/` owns the plugin skills a target project loads live
- `.claude/skills/` owns the toolkit-internal `internal-*` skills, covered in `canon/context/claude-internal/skills.md`
- `docs/workflow/` owns the consumer map a coverage claim is measured against

Each sibling file under `canon/context/claude-plugin/skill-strategy/` covers one question.

- `axes.md` covers how a skill is named and sorted, from the prefix families to the direction axis
- `teaching-and-writing.md` covers the teaching and writing surfaces
- `drafting.md` covers the candidate, draft, identity, and canvas surfaces
- `catalog-health.md` covers whether a skill earns its place, the usage census, and overlap
- `redundancy-audit.md` covers each skill against its community counterpart, and the borrows taken

### The catalog

`canon claude skills list` is the catalog and reports every folder under `claude/skills/`. Run it bare to see which skills exist. Run it with `--json` for objects carrying `name`, `description`, and `requirement`, and with `--names` for one name per line.

These entries hold what a listing cannot recover, being why a skill exists, where its boundary sits, and what a coverage verdict turned on. `claude/skills/context-fold/references/context.md` keeps a catalog a `list` command returns out of an entry and says to link the command so the entry cannot drift.

### The migration prefix

The `migration-*` prefix names a skill performing a one-time structural move of a project into a newer toolkit layout. The family is empty.

- Its members retired once `target-check` shipped, since each encoded one historical transition by hand and went obsolete when it finished, where a check reading current documentation stays true
- A relocation a target still needs reaches it as a `target-check` finding
- A skill name carries no alias, so a target naming a retired skill gets nothing

## Decisions

### The consumer map

`docs/workflow/skill-map.md` carries the when-to-use map, and its tables are what a coverage claim is measured against. Groups run in the order a project meets them, from setup through building, checking, and shipping to the pull request and toolkit sync.

The last two groups hold what serves no single moment and live on `docs/workflow/skill-map-on-request.md`.

- One covers artifacts generated on request
- One covers skills answering a question at any point
- The coverage block spans both pages, with the journey page counting as earlier

The claim names the table rather than the map, because mentions elsewhere in the file reach further than the table does and a prose mention is not a row. Coverage claimed anywhere else does not count.

- The groups derive from `docs/workflow/ai-workflow.md` reconciled against the lifecycle `docs/target/projects.md` describes, not a third vocabulary
- Each skill takes exactly one row, and a skill serving two moments sits at the earlier one
- The map carries no total, because the count moves whenever a skill lands

Nothing checks that the table still covers the corpus. `canon claude skills list --names` reports the set and the comparison is a person's to run, so a new skill opens a gap with nothing reporting it. That check belongs beside the other catalog commands rather than inside a doc rewrite.

### Workflow skills and domain-knowledge skills

Skills split in two by function. The toolkit owns the first and installs the second, and mixing them is the most common source of skill bloat.

- Workflow skills wrap how this toolkit operates, from groundwork to review, shipping, git, and governance install. They are thin and specific to the author's process.
- Domain-knowledge skills encode curated expertise such as frontend design anti-patterns and security audit patterns
- The ecosystem supplies those as `frontend-design`, `impeccable`, `ui-ux-pro-max`, `taste-skill`, and `trailofbits/skills`

Curation is the whole value of the second kind, so forking one means inheriting the cost of maintaining it against a moving upstream. Forking has not been necessary, and a thin toolkit wrapper composing the upstream skill has met the need when it looked tempting.

The right location follows from who benefits.

- `claude/skills/` holds workflow skills installable into targets, such as a commit skill the author uses everywhere
- `.claude/skills/` holds the toolkit-internal `internal-*` family, local to this repository
- A target's `.claude/skills/` holds per-project customization not worth upstreaming
- `~/.claude/skills/` holds global user skills active in every session
- A plugin marketplace holds community and official plugins installed via `/plugin`

The rules this produces fire when a skill is written, so they live in `.claude/skills/internal-claude/SKILL.md` rather than here.

### Three entry points, split by what a question costs

`plan-intake`, `plan-groundwork`, and `plan-feature` are the front doors, and one question routes between them. Can the item be answered by reading the repository today?

- Yes goes to intake, at the cost of a session grepping
- No goes to groundwork, at the cost of runs and days
- Already decided goes to the planning skill

The test runs per item. A dump of forty findings typically holds one that needs measuring, and routing the whole dump on that item buys a folder nobody can close.

### Why intake is its own skill

Intake is a skill rather than a mode inside either neighbor. A mode gives one skill two purposes and its `REQUIREMENT.md` two subjects, the collision the requirement file exists to prevent.

A bare prompt was the other candidate, and it carries no read contract. It cannot orient against the board or measure against the tree, and those steps are what a pass turns on. Groundwork's qualifying guard refuses a breadth pass and names intake as the destination.

### Answering a filed pass

Answering what a pass filed is a second skill, on the same argument that made intake its own front door. `plan-intake-answer` walks the unread slots in batches and lands each selection through `canon intake answer`. It carries `disable-model-invocation`, because a pass that files and answers in one run decides items on silence.

- The write is a verb because every worker runs in a linked worktree, where file-editing tools refuse a main-root path and a shell route would reach for the stream editors this repository bans
- One call carries a whole cluster, since concurrent calls against one file race on the read and keep only the last answer
- A split finding is labeled `3a` and `3b` rather than renumbered, and the label is a string with an optional suffix, because a digits-only parser would drop those items silently

An empty operator slot in an intake folder means unread, where a plan's blank answer means accept. A plan is read in one sitting and an intake folder over weeks, so silence there more likely means nobody reached the item.

### Triaging the backlog reuses the intake record

`backlog-triage` judges the backlog as a whole and is a skill rather than a launch shape for a dispatched planner. A launch shape exists only where an orchestrator composes the dispatch, while the operator calls a triage on their own schedule.

Its record is an ordinary intake folder, with the verdict in `Suggested:` and the task stem in the item heading. `canon intake list`, `canon intake answer`, and `plan-intake-answer` read it unchanged, so the approval between filing and applying is the intake answer contract.

- Filing writes only inside that folder
- Applying writes the board, so the two are phases detected from folder state

### What a skill carries

`canon-cli` routes a job to a verb and carries a guarded per-verb listing on purpose. It names each target-usable top-level verb by its job, never its subcommands or flags, and keeps one line per verb that can lose the project's edits, pointing at `canon docs install-and-sync`.

- A pointer-only body was rejected, because a session needs the job-to-verb route without a `--help` read each time and `canon --help` says nothing about what a sync overwrites
- `src/cli/canon-cli-skill.test.ts` settles the drift, failing on any top-level verb the body neither carries as `canon <verb>` nor exempts as toolkit-only
- It also fails when an exemption names a verb that no longer exists
- A generated listing of every golden config path stays declined, since it ran 70 of 122 lines
- `canon tooling diff` resolves the same paths against a real target, or `canon tooling sync --check` on an older binary

### A citation travels on the skill's own channel

A file a skill body cites has to arrive by the channel the skill travels on. Skills load live from the plugin root while governance rules are copied by a `canon` command, so a body naming an installed path resolves only for a project that ran the install. Nothing reports the break until a session opens the path.

The three orchestrator runbooks settle the rule. They sit in `role-orchestrator`'s own `references/`, cited with `${CLAUDE_SKILL_DIR}`, which resolves from any working directory in any target. The rule is a test on readership rather than topic.

- A file one skill reads ships inside it
- A file several surfaces reach stays in the catalog that publishes it
- `plan-groundwork` and `plan-intake` are edited by sessions that never invoked the skill, so each format lives outside the body, each routed by a rule
- Those are `claude/skills/plan-groundwork/references/groundwork.md` and `claude/skills/plan-intake/references/intake.md`

The sharpest failure is a citation naming no toolkit file. A body sending a reader to a section of the consuming project's own `CLAUDE.md` resolves to nothing in every known target while reading as an ordinary pointer.

- Bodies name `session-worktree` instead, which ships in the plugin and pins no heading a retitling can break
- `src/claude/skills-headings.test.ts` walks `claude/skills/` and fails on that shape, a prose pattern rather than a resolution, since no check can read a target's root file
- It bans this instance and not the class, so a body citing another part of the consuming project's file goes unmeasured

### The typed entry point

A person fires a prompt file by typing its path, so a runbook whose moment the loop cannot detect needs another route. An invocation word is banned by `claude/skills/create-skill/references/skill.md`. The model misreads the flag and runs the vanilla path, and a handoff that silently does not happen is lost at the next compaction.

- A body that routes a plain request to the runbook serving it leaves one flow with no flag
- `role-orchestrator` does this for both compaction sides, and the sweep needs nothing because the loop already reaches it

### Which surface holds an invariant

The readership test also runs against the failure. A path-scoped rule loads when a session opens a file matching its glob, so it reaches what goes wrong inside a folder and never a write that escapes one.

`plan-intake` carries both kinds.

- Its write scope is a floor about paths outside `.canon/intake/`, which no glob over that folder can see
- Its item format and answer contract are what a rule would catch in a session editing the folder with the skill unloaded

Only the second kind is a rule's to hold, and it waits on a standard that does not exist. `claude/skills/create-rule/references/rule.md` has a rule point at the standard owning a document-type convention. A rule beside the bundled reference would make two sources for one text, which the content ownership table in `CLAUDE.md` turns down.

`plan-groundwork` has the identical split, so the pair is one queued change.

### Routing through a body drops at compaction

Routing through the body moves the failure rather than removing it, and a skill carrying `disable-model-invocation` has to say so. The routing is in play only while the body is loaded, and a long session nearing a compaction is the likeliest place to have dropped it.

A body that stops at the routing lets the request land as ordinary conversation with nothing reporting the miss. It owes two recoveries.

- Re-invoke the skill
- Name the runbook paths so a reader can open one with the skill unloaded
