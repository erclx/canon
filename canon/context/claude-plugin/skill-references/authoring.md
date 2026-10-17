---
title: Authoring
description: The canonical template, the success criterion, scope statements, the sibling-section trap, the markdown ban set, and the craft split
---

# Authoring

## Overview

`claude/skills/create-skill/references/skill-reference.md` fixes the shape every shape reference takes, and it governs itself, so it is both the rule and the worked example. This entry records why its rules read the way they do.

- A fenced template where the document type has one
- A success criterion above the shape rules
- A scope statement naming an owner for every exclusion
- A failing artifact behind any change

## Layout

- `claude/skills/create-skill/references/` owns `skill-reference.md`, the shape these decisions explain
- `claude/skills/markdown-craft/references/` owns `markdown.md`, the one reference a code reader stands beside
- `src/markdown/` owns the ban set `canon markdown audit` measures

## Decisions

### The canonical template

A reference governing a document type carries one fenced template of that document, and an attribute reference carries none. A paragraph describing a shape is advisory, and a fenced block is something a check can compare against.

- The placement is not fixed to one heading, since a template beside its rules is one read. `context-fold`'s `context.md` uses `### Template` and `task-board`'s `tasks.md` uses `## File format`.
- An attribute reference governs a scan, a string, or a label, so it is exempt. `git-pr`'s `publish.md`, `git-branch`'s `slug.md`, and `git-commit`'s `versioning.md` each name their own exemption.
- The template outranks the prose where they disagree, because an author copies the block and a contradiction ships as the block

### Where the template rule stops

A generated catalog is out of scope despite reading as a document with no template. `canon indexes regen` rewrites it, so a template added there is deleted by the next `bun run check`.

- `claude/skills/canvas-board/references/design.md` is the sharpest case for the rule, since its tables carry fixed headers the parser reads
- A reference naming the shape without spelling them sends an author into `src/design/parse.ts` and `src/design/render.ts` to recover them
- So any reference gives the headers and labels a tool parses, verbatim

A template and a seed hold different things for the same document, which keeps them from drifting.

- `design.md` carries headers and placeholder rows
- `tooling/claude/seeds/canon/DESIGN.md` carries the starting roles a scaffolded project receives
- Only the headers are load-bearing, since `src/design/render.ts` reads them by exact key and slugs every row name into its variable, so a project can rename, add, or drop a role

### Changing a reference

A reference states a success criterion near the top, above the shape rules. Without one, a proposed change has nothing to be argued against, so the reference gets edited on whichever input arrived last. Two examples.

- `context.md` states its own as `## What a working entry looks like`
- `claude/skills/create-skill/references/skill-requirement.md` scopes one to the requirement file

A reference changes on a failure rather than on a finding.

- A finding is that the vendor docs say X or a paper suggests Y, and it goes to the task board as a hypothesis
- A failure is an artifact that satisfied every shape rule and still missed the criterion, and it edits the reference
- The change cites the failing artifact

### The eval record

`scripts/eval/` produced failures on demand, and its results are the record of what that found. The runner extracted a synthetic fixture outside the repository, copied the live reference in, and asked a headless session to author against it.

Running outside the repository is load-bearing. A fixture under it would load this project's `CLAUDE.md` through the ancestor chain, and the session under test would arrive already knowing what the test measures.

### The sibling section a new rule falsifies

Adding a section can make a claim in a sibling section of the same file false. A section closing on words such as `takes the character checks alone` is accurate while it holds the only rule of its kind, and false the moment a second lands beside it.

- The change checkpoint does not prompt for it, since its collision question asks which sibling reference, rule, or template the change contradicts, not which section of the same file
- Read the neighboring sections for words such as `alone` and `only` before adding a section beside them, and rewrite the one that now claims too much
- No check catches it, because both sentences are well-formed prose citing nothing, so the drift stages and the markdown audit pass

### Scope statements

Every reference declares its jurisdiction in a `## Scope` section, above the shape rules. A reference specifying shape exhaustively and jurisdiction nowhere cannot refuse a rule, so a rule with no obvious owner lands in whichever reference sits nearest and the catalog grows by annexation.

- Every `Does not govern:` entry names an owner, such as a sibling reference, another surface, a coding rule, a project policy, or the code itself. An entry with no owner is cut.
- An entry excluding something no reference was going to claim is padding that settles nothing
- A jurisdiction exclusion is not a content exclusion, since `## Scope` names a concern an outside owner holds and the shape rules name what does not belong inside the document
- A statement stays silent on a section the reference holds but should not own, since claiming it goes false the moment the section moves

### Boundaries declared from both sides

A yield, an exemption, or a handoff written into one reference alone is never read by the reference on the other side, and only the pair is checkable.

`git-pr`'s `publish.md` and `markdown-craft`'s `markdown.md` carry this shape for the cross-reference form, which `canon/context/claude-plugin/skill-references/publish.md` records.

### The three places jurisdiction is written

A reference writes its jurisdiction in the frontmatter `description`, in the enumeration of what the scope statement governs, and in the sentence saying where the reference applies. Widening one and leaving the others reproduces a gap the citation stage cannot see, since it checks that a path resolves and not that three sentences agree.

- The `description` has the most reach. A body reads it to pick the reference, and it is the only one of the three a reader meets without opening the file.
- An enumeration of the artifact's parts carries the same list the shape rules carry, so a part added to one is added to both
- `claude/skills/create-skill/references/skill.md` names the skill folder's contents in its scope sentence and again under `## Structure`, and nothing compares the two

### A reference states its rule and never its enforcement

A reference ships to projects whose hooks, scratch paths, and skill catalogs are their own. A rule justified by this repository's audit hook, or illustrated with this catalog's output filenames, is wrong in a target and nothing reports it.

The reference names the general condition and lets the consuming surface name its own case. `skill-reference.md` carries the rule under `## Staying inside it`. Audit every reference for a violation rather than only the files one change touches, since a pass scoped to one plan's file list leaves the rest reading clean.

### A rule may carry operative directives inline

The prohibition above runs one direction only. A path-scoped rule may carry the operative directives of the reference its owner skill holds, since the rule arrives attached to the edit while a pointer reaches a session only if that session opens the file.

The reference keeps the full specification and the rule keeps what a session must have on arrival. A drift is then a rule falling behind rather than two files disagreeing, and nothing checks it. `canon/context/governance/routing.md` carries the cap on directives beside the pointer.

### The markdown ban set

`canon markdown audit` measures one closed set, the characters `markdown.md` bans under `## Punctuation`. The set ships as data in `src/markdown/bans.ts` rather than being harvested from the reference's prose.

Parsing the reference lost because it put a parser contract on a document authored for people.

- An example chosen to illustrate a pattern became a literal ban on that example
- Renaming a heading emptied the set with nothing reporting it
- A character is the one class a literal match settles, so a word is left to `write-human` as guidance and spelling to no check

The cost is two copies of one list, the prose and the data. The writing rule names the two characters beside its pointer, so a ban added to `bans.ts` is a one-line edit to the rule rather than a silent gap.

### The markdown-craft and write-human split

A reference splits when one half is machine-checkable and the other is a read a session either performs or does not. `markdown.md` carries the format rules, the bans, and the six density limits a command measures. Voice, rhythm, and word choice go to the `write-human` skill, which a markdown edit routes to.

- The density limits replaced "use prose by default", which measured as the main cause of prose-heavy files
- Every writing skill that ends on a file runs `canon markdown audit` over it and fixes what it reports, so no skill restates a number
- Scoping the audit tighter inside one file lost, since it leaves the enforceable rules reading as advice
- Folding the bans into `write-human` lost, since it puts the enforced list behind a skill a session might not load

A single reference holding both halves grades a session on the words it avoided and never on how the prose reads. The split costs a reference citing a skill, and nothing measures whether output follows the rhythm rules.

The writing rule stays pointer-only on both halves. What it routes to is judgment stated across a body and several references, so a rule reproducing part of it would ship the compressible half and leave the half that does the work behind.

## Gotchas

- A section heading in `markdown.md` reads as free to rename, and nothing breaks when it moves, since no code reads the headings
- The writing rule's inline character list is the one copy that can fall behind `bans.ts`
