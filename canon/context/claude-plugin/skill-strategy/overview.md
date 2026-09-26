---
title: Overview
description: Where a plugin skill lives, the catalog command, the consumer map, the workflow against domain-knowledge split, the three entry points, and what a skill body carries
---

# Overview

## Overview

Plugin skills live in `claude/skills/` and are auto-discovered from the plugin root, whether that root is a marketplace install or a `--plugin-dir` pointed at a checkout. No registration is needed, since folder presence is enough. Each skill is a kebab-case folder containing `SKILL.md`. This folder holds why a skill exists and where its boundary sits, which no listing recovers.

## Layout

- `claude/skills/` owns the plugin skills a target project loads live
- `.claude/skills/` owns the toolkit-internal `internal-*` skills, covered in `canon/context/claude-internal/skills.md`
- `docs/workflow/` owns the consumer map a coverage claim is measured against

Each file covers one question:

- `canon/context/claude-plugin/skill-strategy/axes.md`: how a skill is named and sorted, from the prefix families to the direction axis
- `canon/context/claude-plugin/skill-strategy/teaching-and-writing.md`: the teaching, writing, and restatement surfaces
- `canon/context/claude-plugin/skill-strategy/drafting.md`: the proposal, candidate, draft, identity, and walkthrough surfaces
- `canon/context/claude-plugin/skill-strategy/catalog-health.md`: whether a skill earns its place, reading a usage census, the skill not built, and reading the catalog for overlap
- `canon/context/claude-plugin/skill-strategy/redundancy-audit.md`: each skill compared against its community counterpart, and the borrows taken

## The catalog

`canon claude skills list` is the catalog. It reports every folder under `claude/skills/`, `--names` emits those names one per line for a shell caller, and `canon claude skills list --json` returns the set as objects carrying `name`, `description`, and `requirement`. A session looking for which skills exist runs the first, and one looking for what a skill claims to do runs the third.

These entries hold the reasons instead: why a skill exists, where its boundary against a sibling sits, and what a coverage verdict turned on. None of that is recoverable from a listing, and the roster is recoverable from nothing else. `standards/context.md` puts a catalog a `list` command already returns under what does not go in, and says to link the command so the entry cannot drift from it.

The `migration-*` prefix names a skill performing a one-time structural move of a project into a newer toolkit layout, and the family is empty. Its members retired once `target-check` shipped, since each encoded one historical transition by hand and went obsolete the moment that transition finished, where a check reading current documentation stays true for whatever a target falls behind on next. A relocation a target still needs reaches it as a `target-check` finding. A skill name carries no alias, so a target or operator naming a retired skill gets nothing. Recurring reconciliation tools like `seed-sync` are not migrations.

## The consumer map

`docs/workflow/skill-map.md` carries the when-to-use map, and its tables are what a coverage claim is measured against. Groups run in the order a project meets them, from setup through building, checking, and shipping to the pull request and the toolkit-sync relationship. The last two hold what serves no single moment: one for artifacts generated on request, one for skills answering a question at any point.

Naming the map rather than the table leaves the claim open, since mentions elsewhere in the file reach further than the table does, and a passing prose mention is not the same claim as a row. The table is the block, and coverage claimed anywhere else does not count toward it.

The groups derive from the scenarios in `docs/workflow/ai-workflow.md` reconciled against the lifecycle `docs/target/projects.md` describes, rather than a third vocabulary beside those two. Each skill takes exactly one row, so a reader scanning a group reads a set rather than a sample, and a skill honestly serving two moments sits at the earlier one. The map carries no total, because the count moves whenever a skill lands.

Nothing checks that the table still covers the corpus. `canon claude skills list --names` reports the set and the comparison is a person's to run, so a skill added later opens a gap with nothing reporting it. That check belongs beside the other catalog commands rather than inside a doc rewrite.

## Workflow skills and domain-knowledge skills

Skills split into two categories by function. The toolkit owns the first and installs the second, and mixing them is the most common source of skill bloat and maintenance drag.

Workflow skills wrap how this toolkit operates: groundwork, planning, review, shipping, debugging, git, and governance install. They are thin, opinionated, and specific to the author's process.

Domain-knowledge skills encode expertise curated over many hours, such as frontend design anti-patterns, security audit patterns, and industry-specific UI rules. The wider ecosystem supplies those as `frontend-design`, `impeccable`, `ui-ux-pro-max`, `taste-skill`, and `trailofbits/skills`. Curation is the whole value of the second kind, so forking one means inheriting the cost of maintaining that curation against an upstream that keeps moving.

Which location is right follows from who benefits:

- `claude/skills/` holds workflow skills installable into target projects, such as a commit skill the author uses everywhere
- `.claude/skills/` holds the toolkit-internal `internal-*` family, local to this repository
- A target project's `.claude/skills/` holds per-project customization not worth upstreaming, such as a commit style specific to that project
- `~/.claude/skills/` holds global user skills active across every session
- A plugin marketplace holds community and official plugins installed via `/plugin`, such as a frontend design anti-pattern skill a third party maintains

Forking has not been necessary in practice, and when one looks tempting a thin toolkit wrapper composing the upstream skill has met the need instead.

The rules this argument produces fire when a skill is being written, so they live in `.claude/skills/internal-claude/SKILL.md` rather than here.

## Three entry points, split by what a question costs

`plan-intake`, `plan-groundwork`, and `plan-feature` are the front doors, and one question routes between them. Can the item be answered by reading the repository today? Yes goes to intake at the cost of a session grepping, no goes to groundwork at the cost of runs and days, and already-decided goes to the planning skill. The test runs per item, since a dump of forty findings typically holds one that needs measuring and routing the whole dump on its worst item buys a folder nobody can close.

Intake is a skill rather than a mode inside either neighbor. A mode gives one skill two purposes and its `REQUIREMENT.md` two subjects, which is the collision the requirement file exists to prevent. A bare prompt was the other candidate and carries no read contract, so it cannot orient against the board or measure against the tree, and those two steps are what an intake pass turns on. Groundwork's qualifying guard refuses a breadth pass outright and names intake as the destination rather than sending a refused dump to the planning skill.

Answering what a pass filed is a second skill rather than a mode on the first, on the same argument that made intake its own front door. `plan-intake-answer` walks the unread slots in batches and lands each selection through `canon intake answer`, and it carries `disable-model-invocation` so routing never reaches for it mid-flow. A pass that files a dump and answers it in one run decides items on silence, which is the contract inversion the folder exists to hold.

The write is a verb rather than a body instruction because every worker runs in a linked worktree, where the file-editing tools refuse a main-root path and the stream editors this repository bans are what a shell route would reach for. That is the same constraint behind the task record verbs. One call carries a whole cluster, since concurrent calls against one file race on the read and keep only the last answer.

A pass that splits a finding after the fact labels the halves `3a` and `3b` rather than renumbering the file, and a parser accepting digits alone would drop those items with nothing reporting the gap, so the label is a string carrying an optional suffix and the standard says so.

An empty operator slot in an intake folder means unread, where a plan file's blank answer means accept. A plan is read in one sitting and an intake folder is read over weeks, so silence there is far more likely to mean nobody reached the item than that they accepted it.

## Triaging the backlog reuses the intake record

`backlog-triage` judges the backlog as a whole and is a skill rather than a launch shape for a dispatched planner. A launch shape exists only where an orchestrator composes the dispatch, while the operator calls a triage on their own schedule, and a planner launch can still name the skill.

Its record is an ordinary intake folder, with the verdict riding in `Suggested:` and the task stem in the item heading. `canon intake list`, `canon intake answer`, and `plan-intake-answer` read and write it with no change, so the approval between filing and applying is the intake answer contract rather than a second one. Filing writes only inside that folder and applying writes the board, which is why the two are phases detected from folder state rather than one pass.

## What a skill carries

`canon-cli` is the instance of the rule against restating a catalog. Its body keeps what no verb answers: the overwrite table, the sync rules, and the copy-once note on `CLAUDE.md`. A generated listing of every golden config path is what it declines, since that listing ran 70 of 122 lines and `canon tooling diff` resolves the same paths against a real target, or `canon tooling sync --check` on a binary older than that verb. The skill survives because `canon --help` names top-level commands with partial hints and enumerates no subcommands, so nothing in help says whether a sync overwrites.

### A citation travels on the skill's own channel

A file a skill body cites has to arrive by the channel the skill itself travels on. Skills load live from the plugin root while governance rules are copied by a `canon` command, so a body naming an installed path is a dependency crossing that boundary and resolves only for a project that ran the matching install. Nothing reports the break, because an unresolved path produces no error until a session opens it.

The three orchestrator runbooks settle the rule: they sit in `role-orchestrator`'s own `references/`, cited with `${CLAUDE_SKILL_DIR}`, which resolves from any working directory in any target. What this narrows to is a test on readership rather than on topic: a file one skill reads ships inside it, and a file several surfaces reach stays in the catalog that publishes it.

The test cuts both ways. `plan-groundwork` and `plan-intake` are each edited by sessions that never invoked the skill, so their folder format lives at `standards/groundwork.md` and `standards/intake.md` instead, with a rule routing each path.

The sharpest failure of the same test is a citation naming no toolkit file at all. A body sending a reader to a named section of the consuming project's own `CLAUDE.md` resolves to nothing in every known target while reading as an ordinary pointer, so bodies name `session-worktree` instead, which ships in the same plugin and pins no heading a retitling can break. `src/claude/skills-headings.test.ts` walks `claude/skills/` and fails on the shape, which is a prose pattern rather than a resolution because no check can read a target's own root file. It bans this instance and not the class: a body citing any part of the consuming project's file is the wider defect and nothing measures it.

### The typed entry point

The cost is the typed entry point, which is the part worth knowing before moving anything else. A person fires a prompt file by typing its path and cannot type a reference, so a runbook whose moment the loop cannot detect has to be reachable some other way. An invocation word looks like the answer and is banned by `standards/skill.md`, which turns down a flag that selects an alternate flow because the model misreads it and runs the vanilla path, and a handoff that silently does not happen is lost at the next compaction.

What replaces it is a body that routes a plain request to the runbook serving it, leaving one flow with no flag in it. `role-orchestrator` does this for both compaction sides, while the sweep needs nothing because the loop already reaches it.

### Which surface holds an invariant

Which surface holds an invariant follows the same test, run against the failure rather than against the topic. A path-scoped rule loads when a session opens a file matching its glob, so it reaches what goes wrong inside a folder and never reaches a write that escapes one.

`plan-intake` carries both kinds: its write scope is a floor about paths outside `.canon/intake/`, which no glob over that folder can see, while its item format and answer contract are exactly what a rule would catch in a session editing the folder with the skill unloaded.

Only the second kind is a rule's to hold, and `standards/rule.md` has a rule point at the standard owning a document-type convention rather than restate it, so the second kind waits on a standard that does not exist. Writing one beside the skill's bundled reference would make two sources for one text, which is the shape `canon/ARCHITECTURE.md` turns down, and `plan-groundwork` carries the identical split, so the pair is one queued change rather than two.

Routing through the body moves the failure rather than removing it, and a skill carrying `disable-model-invocation` has to say so. The routing is only in play while the body is loaded, and a long session approaching a compaction is the likeliest place to have dropped it, which is the same moment the runbook exists for. A body that stops at the routing leaves the request landing as ordinary conversation with nothing reporting the miss, so it owes two recoveries: re-invoke the skill, and name the runbook paths so a reader can open one with the skill unloaded.
