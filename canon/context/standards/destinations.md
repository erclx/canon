---
title: Destinations
description: The test routing a standard to one home outside the corpus, the destination and purpose recorded per standard, and why the drop bucket came back empty
---

# Destinations

Records where each standard's guidance lives once the corpus stops being a folder a project holds. Every standard resolves to one home, which is a governance rule, a skill body, or the CLI. This entry decides and records. It moves nothing and repoints no citation, both of which belong to the sweep behind it.

## Decisions

### The test routes on what the standard governs, not on how many surfaces cite it

A standard already declares which branch it takes, in the first sentence of its own `## Scope`. A document-type standard names the backticked paths it governs, and an attribute standard says so and resolves to `*`. `read_applies_to` in `scripts/standards/list.sh` already parses that sentence for `appliesTo`, so the routing signal is measured rather than assigned.

- **A document type a project authors** goes to the governance rule that globs that document. The rule reaches the author while the file is open, which is the moment the guidance has to arrive. Seventeen have one.
- **An attribute with no document** cannot be globbed, so it goes to the CLI when a verb can compute or check it, and to the skills that run it otherwise.
- **A procedure only one surface runs** goes to that surface's `references/`, hand-authored there.
- **Nothing reaches it** and it is dropped, with the readership recorded. The bucket is empty.

Readership decides nothing here on its own. It is the four channels the task carries, being a skill body, a governance rule, a CLI verb, and a seed, and a zero on one channel can mean well-routed rather than unread. `design.md` is cited by no skill in either catalog and is reached by a rule, a seed, and a context entry.

### The fan-out was a destination with a ceiling, and the ceiling is why it is gone

Copying a standard into each consumer's `references/` was the established route for a standard several skills read, six bundled sources producing eleven copies. It stayed affordable while the consumer set was small and stopped at roughly a handful, since `markdown.md` at 21 citing bodies and `slug.md` at 13 would each have produced a copy per body, which is the duplication the fan-out existed to prevent.

The same ceiling closed the route entirely rather than only bounding it. A root standard costs zero copies at any consumer count, which is what the fallback citation form, `${CLAUDE_SKILL_DIR}/../../standards/<name>.md`, already delivered for the standards then at the flat root, 21 of them at `16a80339` on 2026-08-25, so the six bundled ones reached the same form at the same cost once they moved. `standards/bundled/` is retired: the six sources sit at the flat root and the eleven copies are gone. `.claude/ARCHITECTURE.md` carries the decision and the premise it corrects, that no bundled standard ever installed regardless of the folder, so the install channel closing never severed their reach.

Counting the bodies that cite a standard reads short of the set a move has to satisfy, which is what the `versioning.md` withdrawal below turns on. A flat standard's reader set is the skills, the flat standards depending on it in-body, and any installed rule naming it, since a fan-out move is no longer a destination to weigh against.

### A rule delivers the standard it routes to rather than absorbing it

The seventeen document-type standards route to the governance rule that globs them, and the rule names `canon standards <name>` rather than carrying the guidance itself. Folding it in was the reading the routing sentence admits, and it costs roughly 2,400 lines against eighteen rules totalling 377, which turns a 16 to 29 line rule into a 100 to 300 line one and reproduces the standard's whole structure inside the pointer to it.

What the rule delivers is arrival rather than text. It fires on the glob while the file is open, which is the property the census routed on, and a pointer a session can execute serves that as well as an inlined copy would. Settled by the operator on 2026-08-20.

### A verb is the home for a rule stated across every reader

One attribute standard lands on the CLI, which is `markdown.md`, whose ban sets and structural checkpoints ship as data in `src/markdown/`. Two more were recorded here on the same reasoning, that a transform and a scan are each a value a caller reads rather than a shape a caller writes, and both were withdrawn once the reasoning was measured rather than asserted. A closed list a check already walks earns a verb. A value every caller reads and no caller restates does not, because there is no duplication for the verb to collapse and the standard still has to state the rule for the reader.

## Gotchas

- The meta-standard's subject is the corpus this census is dissolving. `standard.md` routes to `591-standard-authoring.md` while standards remain a document type someone authors, and it is the one entry whose destination expires if the corpus does. Nothing detects that, because a rule globbing an empty folder reports the same as one globbing a full folder.
- A destination recorded against a carrier nobody has built reads identically to one recorded against a live carrier, and only the marker below separates them. Nothing now reads `to write`: two rules and one skill destination were built, and three were withdrawn into a section of their own so a reversal does not read as an arrival.
- `internal/standards/tooling-reference.md` is outside this census. It never installs into a target, so it has no corpus to leave, and `595-tooling-reference.md` already carries it.
- A destination is not an install channel. Recording a home for every standard leaves the folder in place and leaves it installing, so the outcome about nothing living only in an installed folder stays open until the sweep and the install removal behind it run.

The `consumers` field and the fan-out it drove are retired. Removing a skill from a bundled standard's `consumers` field used to leave the copy already sitting in that skill's `references/`, orphaned rather than deleted, since `scripts/core/regen-skill-references.sh` walked the bundled folder and copied with no pass that removed a file the field no longer named, while `assert_no_drift` compared the working tree against HEAD rather than against a fresh regen. Narrowing `standards-audit` is what surfaced it, dropping the skill from `consumers` in `standards/bundled/branch.md` and `standards/bundled/pr.md` and leaving an orphan that read clean because it was already committed. Nothing on this shape can recur: a flat standard has no copy to orphan, and the readership a `consumers` field once recorded now lives as prose under `## Destinations` below.

Shipping a dependency beside its consumer connects them only when the consumer's cited path resolves against the root that now holds it. The marketplace symlinks put `standards/` and `snippets/` into the plugin cache, and a headless run in a project with no `.claude/` showed the skill resolving `.claude/standards/versioning.md` against the project root, finding nothing, and never looking in its own plugin root, while a `references/` file bundled inside the same skill folder resolved in the same run because that path is relative to the skill. Delivery succeeded and reach did not. Name the root each cited path resolves against before calling such an outcome met, and test in a target that lacks the file rather than one with its own copy. The reach half closed by citing `${CLAUDE_SKILL_DIR}/../../standards/<name>.md` as a fallback after the project path.

## Destinations

Twenty-seven standards carry a row below, all at the flat root now that `bundled/` is retired. Each carries its purpose and the home it routes to. `arrived` marks a home the guidance already sits in, and the `Withdrawn` section holds the destinations re-decided rather than built. Every carrier the census named has now either landed or been reversed, so no row is waiting on one.

The corpus stands at 31, so four standards authored after the census carry no row. `mermaid.md` reaches a session through `502-mermaid.md`, which globs a fence rather than a document type. `docs.md` reaches one through the `docs-sync` read list, which is the destination a skill takes when no rule globs the folder, and the root file states in as many words that none is scoped at `docs/`. Routing the edit at that skill is what the root file already does, so the citation lands where a session editing a page under the folder is already sent. `wiki.md` takes the ordinary document-type route the census closed for seventeen others: `597-wiki.md` globs `wiki/**/*.md` and points at it, trimmed to that pointer once the standard absorbed the placement criterion the rule used to state by hand. `figures.md` is a fragment standard with no document type of its own to glob, so no rule carries it, and it reaches a session through the citation each caller's own body writes, the same fallback form a flat standard already takes when nothing globs it.

### To the CLI

- `markdown.md` fixes what a check can decide about any markdown file. `canon markdown audit`, arrived, with `501-markdown.md` left pointing at it.

`slug.md` and `publish.md` were recorded here and are withdrawn below.

### To an existing governance rule

- `architecture.md` fixes what a cross-domain decision record holds. `540-architecture.md`.
- `context.md` fixes the per-domain narrative entry. `510-context.md`.
- `design.md` fixes visual intent and the token tables. `550-design.md`.
- `diagrams.md` fixes the per-kind Mermaid entry. `560-diagrams.md`.
- `groundwork.md` fixes the measurement track a topic gets before anyone plans it. `556-groundwork.md`.
- `intake.md` fixes the folder a raw dump is filed into. `557-intake.md`.
- `memory.md` fixes the pen entry and its lifecycle from write to retire. `559-memory.md`.
- `plan.md` fixes the plan file and the suggested-and-answer contract a worker executes. `558-plan.md`.
- `readme.md` fixes the voice and structure of the page a project leads with. `580-readme.md`.
- `requirements.md` fixes the problem, goals, and non-goals record. `530-requirements.md`.
- `rule.md` fixes a path-scoped governance rule. `590-rule-authoring.md`.
- `session.md` fixes the pre-compaction handoff. `562-session.md`, which globs the `session-` file alone because `555-tasks.md` globs the board around it and one rule over both shapes would carry two.
- `skill.md` fixes the skill folder, its frontmatter, and its invocation contract. `570-skill.md`.
- `standard.md` fixes a standard's frontmatter, scope statement, and success criterion. `591-standard-authoring.md`.
- `tasks.md` fixes the board, its filenames, and its readiness groups. `555-tasks.md`.
- `teach.md` fixes the learning workspace layout, its ordinal naming, and its mission and record formats. `561-teach.md`, whose frontmatter states that most targets open no workspace for it to fire on. The pedagogy stays in `teach-workspace`, which is the split the architecture record already fixes.
- `wireframes.md` fixes layout and interaction intent before any UI exists. `520-wireframes.md`.

### To a skill, cited from the flat root

Six standards were routed to a narrow readership rather than to a governance rule, and each shipped from `standards/bundled/` through a generated copy in every consuming skill's `references/` until the fan-out retired. All six now sit at the flat root beside the other 21 and reach the same skills through `${CLAUDE_SKILL_DIR}/../../standards/<name>.md`, the fallback citation form. The consumer list below is what the retired `consumers` frontmatter field used to record.

- `branch.md` fixes the branch name and its type vocabulary. `git-branch`, `git-split`, `git-pr`, and `session-worktree`, arrived.
- `commit.md` fixes the commit subject. `git-commit` and `git-stage`, arrived.
- `issue.md` fixes an issue body. `git-issue`, arrived.
- `pr.md` fixes a pull request title and body. `git-split` and `git-pr`, arrived.
- `snippets.md` fixes a snippet file. `create-snippet`, arrived.
- `glossary.md` fixes the file holding one entry per term a body of material defines. `teach-workspace`, arrived. Its path is fixed by whichever surface holds a glossary rather than by the standard, so no glob covers it while one skill reads it.

### Withdrawn

Three destinations the census recorded were re-decided rather than built, each on a premise that did not survive re-measurement. A row here is a decision reversed, not a carrier waiting, which is the distinction the marker above cannot carry on its own.

- `slug.md` was routed to a verb emitting the slug, on thirteen skill bodies restating the transform. None of them does. Each cites the standard and then states its own empty-result response, which is what that standard's `## An empty result` section instructs, so the duplication a verb would collapse does not exist. Withdrawn by the operator on 2026-08-20 against a re-measurement at `b26506ee`. It stays in the flat corpus reached by citation.
- `publish.md` was routed to a verb returning the cross-reference form and the unreadable-source branch, on the same reasoning about a value a caller reads. Withdrawn with `slug.md` and on the same day, since neither verb had a caller that would stop restating anything. It stays in the flat corpus, cited by seven skill bodies.
- `versioning.md` was routed to `task-board`, `git-commit`, and `git-pr` through the fan-out, on three consumers sitting inside the ceiling. Two of its readers are standards rather than skills, and that is what the withdrawal turns on rather than the ceiling: `publish.md` and `tasks.md` each depend on it in-body, and neither is leaving, since `tasks.md` routes to `555-tasks.md` and `publish.md` is withdrawn above. A standard cites a sibling at the flat root, not a copy sitting inside one consuming skill's folder, so moving `versioning.md` into the fan-out would have pointed both readers at a file neither could reach. Withdrawn by the operator on 2026-08-20, re-measured at `653bbb15`. The fan-out itself is gone now, so the withdrawal stands on the same reasoning with one fewer route to have chosen.
