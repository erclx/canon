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

### A standard's reader set spans more than the skills that cite it

Every standard resolves through the flat root at zero copies, via `${CLAUDE_SKILL_DIR}/../../standards/<name>.md`, whatever its readership. No destination copies a standard into each consumer's `references/`: `standards/bundled/` does not exist, and `canon/context/standards/resolution.md` carries the reasoning that closed it.

A standard's reader set is wider than the skill bodies that cite it. It is the skills, the flat standards that depend on it in-body, and any installed rule naming it, which is what the `versioning.md` withdrawal below turns on.

### A rule delivers the standard it routes to rather than absorbing it

The seventeen document-type standards route to the governance rule that globs them, and the rule names `canon standards <name>` rather than carrying the guidance itself. Folding the guidance in is the rejected alternative: it costs roughly 2,400 lines against eighteen rules totalling 377, turning a 16 to 29 line rule into a 100 to 300 line one and reproducing the standard's whole structure inside the pointer to it.

What the rule delivers is arrival rather than text. It fires on the glob while the file is open, and a pointer a session can execute serves that as well as an inlined copy would.

### A verb is the home for a rule stated across every reader

One attribute standard lands on the CLI: `markdown.md`, whose ban sets and structural checkpoints ship as data in `src/markdown/`. A closed list a check already walks earns a verb. A value every caller reads and no caller restates does not, because there is no duplication for the verb to collapse and the standard still has to state the rule for the reader, which is what the two withdrawals below turn on.

## Gotchas

- The meta-standard's subject is the corpus this census is dissolving. `standard.md` routes to `591-standard-authoring.md` while standards remain a document type someone authors, and it is the one entry whose destination expires if the corpus does. Nothing detects that, because a rule globbing an empty folder reports the same as one globbing a full folder.
- A destination recorded against a carrier nobody has built reads identically to one recorded against a live carrier, and only the marker below separates them. Nothing reads `to write`: every destination below is either `arrived` or moved to `## Withdrawn`, so a reversal does not read as an arrival.
- `internal/standards/tooling-reference.md` is outside this census. It never installs into a target, so it has no corpus to leave, and `595-tooling-reference.md` already carries it.
- A destination is not an install channel. The corpus has no install channel, so recording a home for a standard is the only route its guidance reaches a project through.

The `consumers` field and the fan-out it drove do not exist. A flat standard has no copy to orphan, and the readership a `consumers` field once recorded now lives as prose under `## Destinations` below.

Shipping a dependency beside its consumer connects them only when the consumer's cited path resolves against the root that now holds it. The marketplace symlinks put `standards/` and `snippets/` into the plugin cache, so a citation resolving against a project root rather than the skill's own root finds nothing there even though the file ships. Name the root each cited path resolves against before calling reach met, and test in a target that lacks the file rather than one already holding its own copy. `${CLAUDE_SKILL_DIR}/../../standards/<name>.md` is the fallback form that resolves against the skill's own root rather than the project's.

## Destinations

Twenty-seven standards carry a row below, all at the flat root. Each carries its purpose and the home it routes to. `arrived` marks a home the guidance already sits in, and `## Withdrawn` holds the destinations re-decided rather than built.

The corpus stands at 31, so four standards carry no row. `mermaid.md` reaches a session through `502-mermaid.md`, which globs a fence rather than a document type. `docs.md` reaches one through the `docs-sync` read list, the destination a skill takes when no rule globs the folder, since the root file states that none is scoped at `docs/`. `wiki.md` takes the ordinary document-type route: `597-wiki.md` globs `wiki/**/*.md` and points at it.

`figures.md` is a fragment standard with no document type of its own to glob, so no rule carries it. It reaches a session through the citation each caller's own body writes, the fallback form a flat standard takes when nothing globs it.

### To the CLI

- `markdown.md` fixes what a check can decide about any markdown file. `canon markdown audit`, arrived, with `501-markdown.md` left pointing at it.

`slug.md` and `publish.md` are withdrawn below rather than routed here.

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
- `ready.md` fixes the finished-file handoff folder, its overview frontmatter, and the thin-plan contract that ships it. `563-ready.md`.
- `requirements.md` fixes the problem, goals, and non-goals record. `530-requirements.md`.
- `rule.md` fixes a path-scoped governance rule. `590-rule-authoring.md`.
- `session.md` fixes the pre-compaction handoff. `562-session.md`, which globs the `session-` file alone because `555-tasks.md` globs the board around it and one rule over both shapes would carry two.
- `skill.md` fixes the skill folder, its frontmatter, and its invocation contract. `570-skill.md`.
- `standard.md` fixes a standard's frontmatter, scope statement, and success criterion. `591-standard-authoring.md`.
- `tasks.md` fixes the board, its filenames, and its readiness groups. `555-tasks.md`.
- `teach.md` fixes the learning workspace layout, its ordinal naming, and its mission and record formats. `561-teach.md`, whose frontmatter states that most targets open no workspace for it to fire on. The pedagogy stays in `teach-workspace`, which is the split the architecture record already fixes.
- `wireframes.md` fixes layout and interaction intent before any UI exists. `520-wireframes.md`.

### To a skill, cited from the flat root

Five standards route to a narrow readership rather than to a governance rule. All five sit at the flat root and reach their skills through `${CLAUDE_SKILL_DIR}/../../standards/<name>.md`, the fallback citation form.

- `branch.md` fixes the branch name and its type vocabulary. `git-branch`, `git-split`, `git-pr`, and `session-worktree`, arrived.
- `commit.md` fixes the commit subject. `git-commit` and `git-stage`, arrived.
- `pr.md` fixes a pull request title and body. `git-split` and `git-pr`, arrived.
- `snippets.md` fixes a snippet file. `create-snippet`, arrived.
- `glossary.md` fixes the file holding one entry per term a body of material defines. `teach-workspace`, arrived. Its path is fixed by whichever surface holds a glossary rather than by the standard, so no glob covers it while one skill reads it.

### Withdrawn

Three destinations were re-decided rather than built, each on a premise that did not survive re-measurement. A row here is a decision reversed, not a carrier waiting, which is the distinction the marker above cannot carry on its own.

- `slug.md` was considered for a verb emitting the slug, on the premise that skill bodies restate the transform. None of them does: each cites the standard and then states its own empty-result response, which is what that standard's `## An empty result` section instructs, so the duplication a verb would collapse does not exist. It stays in the flat corpus reached by citation.
- `publish.md` was considered for a verb returning the cross-reference form and the unreadable-source branch, on the same reasoning about a value a caller reads. Neither verb would have had a caller that stops restating anything, so it stays in the flat corpus, cited by seven skill bodies.
- `versioning.md` was considered for the fan-out, on `task-board`, `git-commit`, and `git-pr` as its three consumers. Two of its readers are standards rather than skills: `publish.md` and `tasks.md` each depend on it in-body. A standard cites a sibling at the flat root rather than a copy sitting inside one consuming skill's folder, so moving `versioning.md` into a fan-out would have pointed both readers at a file neither could reach. It stays in the flat corpus for that reason, independent of the fan-out's own retirement.
