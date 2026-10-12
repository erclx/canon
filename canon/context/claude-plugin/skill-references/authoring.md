---
title: Authoring
description: The canonical template and where it stops, the success criterion and changing on a failure, the sibling section a new rule falsifies, scope statements and the three places jurisdiction is written, rules beside references, the markdown ban set, and the markdown-craft against write-human split
---

# Authoring

## Overview

`claude/skills/create-skill/references/skill-reference.md` fixes the shape every shape reference takes, and it governs itself, so it is both the rule and the worked example. This entry records why its rules read the way they do: a fenced template where the document type has one, a success criterion above the shape rules, a scope statement naming an owner for every exclusion, and a failing artifact behind any change.

## Layout

- `claude/skills/create-skill/references/` owns `skill-reference.md`, the shape these decisions explain
- `claude/skills/markdown-craft/references/` owns `markdown.md`, the one reference a code reader stands beside
- `src/markdown/` owns the ban set `canon markdown audit` measures

## Decisions

### The canonical template

A reference governing a document type carries one fenced template of that document, and an attribute reference carries none. A paragraph describing a shape is advisory and a fenced block is something a check can compare against.

The placement is not fixed to one heading. `claude/skills/context-fold/references/context.md` carries its template under `### Template`, and `claude/skills/task-board/references/tasks.md` carries the same kind of block inside `## File format`. Both placements stay legal, since a template beside the rules it satisfies is one read and a fixed heading would move the tasks block away from them.

An attribute reference is exempt because it governs a scan, a string, or a label rather than a document type, so a template would have nothing to show. `claude/skills/git-pr/references/publish.md`, `claude/skills/git-branch/references/slug.md`, and `claude/skills/git-commit/references/versioning.md` each name their own exemption in the sentence declaring that they govern an attribute, which is the both-sides rule applied to a claim that would otherwise be a silence.

The template outranks the prose where they disagree. An author copies the block, so a contradiction ships as the block whatever the prose says, and naming the winner makes the drift a defect a reader can see rather than one that resolves differently per session.

### Where the template rule stops

A generated catalog is out of scope despite reading as a document with no template. `canon indexes regen` rewrites it, so a template added there is deleted by the next `bun run check`.

`claude/skills/canvas-board/references/design.md` is the sharpest case for the rule: the token tables carry fixed headers the renderer reads, and a reference that names the shape without spelling those headers verbatim sends an author into `src/design/parse.ts` and `src/design/render.ts` to recover them. The template rule asks any reference for the headers and labels a tool parses, verbatim, which is the general form of what `design.md` would otherwise leave missing.

A template and a seed hold different things for the same document, which is what keeps them from drifting. `design.md` carries headers and placeholder rows, and `tooling/claude/seeds/canon/DESIGN.md` carries the starting roles a scaffolded project receives. Only the headers are load-bearing, since `src/design/render.ts` reads those by exact key and slugs every row name into the variable it emits, so a project is free to rename, add, or drop a role.

### Changing a reference

A reference states a success criterion, near the top and above the shape rules. Specifying structure exhaustively and success nowhere leaves nothing to argue a proposed change against, so the reference gets edited on whichever input arrived most recently. `context.md` states its own as `## What a working entry looks like`, and `claude/skills/create-skill/references/skill-requirement.md` states one scoped to the requirement file rather than the skill.

A reference then changes on a failure rather than on a finding. A finding is that the vendor docs say X or a paper suggests Y, and it goes to the task board as a hypothesis. A failure is an artifact that satisfied every shape rule and still missed the criterion, and it edits the reference. The change cites the failing artifact.

`scripts/eval/` was how a failure got produced on demand, and its results are the record of what that found. The runner extracted a synthetic fixture outside the repository, copied the live reference in, and asked a headless session to author against it. Running outside the repository is load-bearing: a fixture under it would load this project's `CLAUDE.md` through the ancestor chain, and the session under test would arrive already knowing what the test is trying to measure.

### The sibling section a new rule falsifies

Adding a section to a reference can make a claim in a sibling section of that same file false. A section closing on words such as `takes the character checks alone` is accurate while it holds the only rule of its kind and false the moment a second one lands beside it. A reader arriving at the older section first concludes the file has nothing further to say, which is the reading the new section depends on being wrong.

The change checkpoint does not prompt for it. Its collision question asks which sibling reference, rule, or template the change contradicts, so a sibling section inside the file being edited falls outside what the four questions reach. Read the neighboring sections for words such as `alone` and `only` before adding a section beside them, and rewrite the one that now claims too much.

The failure is invisible to every check the repository runs. Both sentences are well-formed prose citing nothing, so the drift stages, and the markdown audit all pass over a file that now states two incompatible things.

### Scope statements

Every reference declares its own jurisdiction in a `## Scope` section, above the shape rules. A reference that specifies shape exhaustively and jurisdiction nowhere cannot refuse a rule, so a rule with no obvious owner lands in whichever reference sits nearest and the catalog grows by annexation. No single step has to look wrong for a reference to reach a second owner's rules, which is why the statement is what a step fails against.

Every `Does not govern:` entry names an owner, and an entry with no owner is cut rather than written. The owner is usually a sibling reference and may be another surface, a coding rule, a project policy, or the code itself. An entry excluding something no reference was going to claim is padding that makes the list look thorough and settles nothing.

A jurisdiction exclusion is not a content exclusion. `## Scope` names a concern an owner outside this reference holds, and the shape rules name what does not belong inside the document. Merging the two puts a boundary claim where no sibling will read it.

A scope statement declares its boundaries from both sides. A yield, an exemption, or a handoff written into one reference alone is never read by the reference on the other side of it. Both halves are cheap to write and only the pair is checkable. `claude/skills/git-pr/references/publish.md` and `claude/skills/markdown-craft/references/markdown.md` carry this shape for the cross-reference form, which `canon/context/claude-plugin/skill-references/publish.md` records.

A scope statement stays silent on a section the reference holds but should not own. Claiming it makes the statement false the moment the section moves, and the visible mismatch is the evidence that moves it.

### The three places jurisdiction is written

A reference writes its jurisdiction in three places: the frontmatter `description`, the enumeration of what the scope statement governs, and the sentence saying where the reference applies. Widening one and leaving the others reproduces a gap the citation stage cannot see, since it checks that a path resolves rather than that three sentences agree.

The `description` has the most reach. A body reads it to pick the reference, and it is the only one of the three a reader meets without opening the file.

A statement enumerating the parts of the artifact it governs carries the same list the shape rules carry, so a part added to one is added to both or the reference contradicts itself. `claude/skills/create-skill/references/skill.md` names the skill folder's contents in its scope sentence and again under `## Structure`. Nothing compares the two automatically, so the second enumeration is the cost of naming parts in a statement whose job is naming owners.

### A reference states its rule and never its enforcement

A reference ships to projects whose hooks, scratch paths, and skill catalogs are their own, so a rule justified by this repository's audit hook or illustrated with this catalog's output filenames is wrong in a target and nothing reports it. The reference names the general condition and lets the consuming surface name its own case. `skill-reference.md` carries the rule under `## Staying inside it`.

Audit every reference for a violation rather than only the files one change touches, since a pass scoped to one plan's file list leaves the rest reading clean.

### A rule may carry operative directives inline

The prohibition above runs one direction only. A path-scoped rule may carry the operative directives of the reference its owner skill holds, since the rule arrives attached to the edit while a pointer reaches a session only if that session opens the file. The reference keeps the full specification and the rule keeps what a session must have on arrival, so a drift is a rule falling behind rather than two files disagreeing, and nothing checks it.

`canon/context/governance/routing.md` carries the cap on how many directives sit beside the pointer.

### The markdown ban set

`canon markdown audit` measures one closed set, the characters `markdown.md` bans under `## Punctuation`, and the set ships as data in `src/markdown/bans.ts` rather than being harvested from the reference's prose. Parsing the reference was the alternative, and it lost because it put a parser contract on a document authored for people: an example chosen to illustrate a pattern became a literal ban on that example, and renaming a heading emptied a set with nothing reporting it. A character is the one class a literal match settles, so a word is left to `write-human` as guidance and a spelling to cspell.

The cost is two copies of one list, the prose and the data. The writing rule names the two characters beside its pointer, so a ban added to `bans.ts` is a one-line edit to the rule rather than a silent gap.

### The markdown-craft against write-human split

A reference splits when one half is machine-checkable and the other is a read a session either performs or does not. `markdown.md` carries the format rules and the bans a command measures. Voice, rhythm, and information density go to the `write-human` skill, which a markdown edit routes to.

Scoping the audit tighter inside one file is the alternative, and it leaves the enforceable rules reading as advice. A single reference holding both halves grades a session on the words it avoided and never on how the prose reads. Folding the bans into `write-human` lost too, since it would put the enforced list behind a skill a session might not load. The split costs a reference citing a skill, and nothing measures whether output follows the rhythm rules.

The writing rule stays pointer-only on both halves. What it routes to is judgment stated across a body and several references, so a rule reproducing part of it would ship the compressible half and leave the half that does the work behind.

## Gotchas

- A section heading in `markdown.md` reads as free to rename, and nothing breaks when it moves, since no code reads the headings. The writing rule's inline character list is the one copy that can fall behind `bans.ts`.
