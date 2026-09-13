---
title: Scope model
description: Which tree a standard lives in, what its scope statement declares, when a standard splits, and how the statement is parsed
---

# Scope model

A standard answers two questions before it answers anything about its own shape: which of the three authoring trees it belongs in, and what jurisdiction it claims once it is there. Both are checkable from outside the file, which is why the parser reading the scope statement constrains how that statement is written.

## Which tree a standard lives in

The root is the authoring source and there is no consumed copy beneath it. `snippets/` and `governance/rules/` still mirror under `.claude/`, and standards left that pattern once nothing installed the corpus into a project, so the one spelling a mirror bought was a path only this repository could resolve. A citation now takes the form its carrier resolves, which `internal/rules/claude/598-authoring-layout.md` states as one case apiece. Standards are uniform across every project, with no stack variation and no extends chain, so nothing resolves at install time.

A convention governing a surface only the toolkit has lives in `internal/standards/`, a tree no CLI entry point and no plugin symlink reads. A filter at each entry point was the alternative, and it cannot see a symlink an installer dereferences. Location is what enforces the boundary, so nothing has to remember to exclude it.

A convention consumed by a specific skill rather than authored by a project used to live in `standards/bundled/`, each carrying a `consumers:` field a fan-out read to copy it into every listed skill's `references/`. That route is retired. A narrow-readership convention lives in the flat root like every other standard, cited through `${CLAUDE_SKILL_DIR}/../../standards/<name>.md`.

Narrow readership was the fan-out's criterion, not portability, and `canon/ARCHITECTURE.md` records why the two came apart and why the fan-out closed after. It wrote one copy per consumer, so a standard several surfaces read cost a copy each time it moved there, while the plugin symlink already put the flat root on disk for anyone who installed the plugin. A file the whole corpus cited therefore stayed in the flat root however portable the bundled folder looked, and once that same fallback citation was measured against the narrow-readership case too, it reached those at zero copies as well, which is what closed the folder rather than only bounding it.

A procedure several skills execute mid-run gets a standard of its own in the flat root rather than a section inside whichever standard already held one of its rules. `standards/publish.md`, `standards/slug.md`, and `standards/session.md` are the three, each cited from every body that runs it. All three take a one-word name, which every installable standard carries.

A subfolder was not available for them, since install and the sync adapter walk the flat root only. A combined `procedures.md` was the other candidate and recreates the aggregation at a new address.

`session.md` is the one of the three that also governs a document, so it took the flat root on two counts rather than one. The bundled folder, while it still existed, would have been the closer fit for a file two skills read, and the paragraph above already rules that route out for anything the flat root delivers. What decided it against the bundled folder even before the folder closed is that the standard has to reach a session holding no skill at all, since a compaction takes the routing to the skill before it takes the file.

The name follows the artifact's own path segment, which is what every standard here does: `plan.md` over `.canon/plans/feature-<slug>.md`, `memory.md` over `.canon/memory/<type>-<slug>.md`, and `session.md` over `.canon/tasks/session-<slug>.md`. It shipped as `session-map.md` and was renamed before merge, since a standard is cited by bare filename from every surface that reads one, so the cost of an outlier name only grows. `handoff.md` was the other candidate and it collides: this corpus already calls a `Does not govern:` pointer a scope handoff, and `groundwork.md` already calls its own last file the handoff, so the one word would name three artifacts across three standards.

That derivation is now stated in `standards/standard.md` under `## Scoping rules` and checked by `canon records validate standards`. The rule went in first, because a check asserting an unwritten convention reports an author for something nobody told them, which is what the rename above cost. Stating the derivation is what the rule had to do rather than stating the shape: one word is the output across all 27 authored standards, and a check keyed on word count would pass a conforming single word naming the wrong artifact.

The check derives from the scope statement, so it inherits every constraint the parsing section below records. An attribute standard is exempt because it governs no path, a statement anchoring nothing is reported rather than passed, and a finding on a name says what the rename reaches, since the hero frame lists standards by name and a row moves whether or not a count does.

## What a standard declares

A standard states its rule and never what enforces it here. These files install into projects whose hooks, scratch paths, and skill catalogs are their own, so a rule justified by this repository's audit hook or illustrated with this catalog's output filenames is wrong in a target and nothing reports it. Name the general condition and let the consuming surface name its own case.

That prohibition runs one direction only. A path-scoped rule may carry the operative directives of the standard it points at, since the rule arrives attached to the edit while a pointer reaches a session only if that session opens the file. The standard keeps the full specification and the rule keeps what a session must have on arrival, so a drift is a rule falling behind rather than two files disagreeing. Nothing checks it.

That exemption is empty and the reason it emptied is recorded in `canon/ARCHITECTURE.md`. The three ban sets ship as package data `canon markdown audit` reads, so no standard is parsed and the rule pointing at `markdown.md` may carry operative directives like any other.

`500-prose` stays pointer-only on a different argument. What it routes to is the `write-human` skill rather than a standard, and the guidance there is judgment stated across a body and three references, so a rule reproducing five bullets of it would ship the compressible half and leave the half that does the work behind. Routing to a skill from a rule was previously declined on the ground that it trades a certain load for a probable one, and the operator overturned that on 2026-08-19. The trade the objection describes is not the one this design makes: the rule still loads on the glob and carries an explicit instruction to load the skill, so the instruction arrives with certainty and what follows is an instruction being followed rather than a description being matched.

The rule lives in `standards/standard.md` under `## Scoping rules`, routed to every standards edit by `591-standard-authoring`, because a decision recorded here governs nothing an author reads while editing. Audit the whole corpus for a violation of it rather than the files that prompted it, since a pass scoped to one plan's file list leaves the rest reading clean.

Every standard declares its own jurisdiction in a `## Scope` section, above the shape rules. A standard that specifies shape exhaustively and jurisdiction nowhere cannot refuse a rule, so a rule with no obvious owner lands in whichever standard sits nearest and the corpus grows by annexation.

No single step has to look wrong for a standard to reach a second owner's rules, which is why the statement is what a step fails against. A sibling `REQUIREMENT.md` per standard was the alternative and it restates what a standard already is, since a standard is a specification and a skill body is not.

A scope statement declares its boundaries from both sides. A yield, an exemption, or a handoff written into one standard alone is never read by the standard on the other side of it, which is how the retired `prose.md` came to grant a voice yield that only two of its four eligible siblings ever claimed. Both halves are cheap to write and only the pair is checkable.

## When a standard splits

A standard splits when one half is machine-checkable and the other is a read a session either performs or does not. `prose.md` held both and shipped as one advisory file. The first split gave `markdown.md` the headings, lists, code spans, punctuation, emphasis, and file references, and left voice, language, and frontmatter wording behind.

The second split retired the file. Language and frontmatter wording joined `markdown.md`, which is where every ban a command measures now sits, and voice, rhythm, and information density went to the `write-human` skill, which a markdown edit routes to. Splitting by subject was what the first pass did and it left one file still holding a measured half and an advisory one, so the second pass split by what reads each half instead.

Scoping the audit tighter inside one file was the alternative and it leaves the enforceable rules reading as advice, which is the defect. The seam cost a citation sweep across 79 files the first time and roughly 90 the second.

## The scope statement

A jurisdiction exclusion is not a content exclusion. `## Scope` names a concern an owner outside this standard holds, and `## What does not go in` names what does not belong inside the document. Eight standards carried the second under two spellings and none carried the first, so only the bullets naming an owner moved up. Merging the two puts a boundary claim where no sibling will read it.

Every `Does not govern:` entry names an owner, and an entry with no owner is cut rather than written. The owner is usually a sibling standard and may be another surface, a coding rule, a project policy, or the code itself. An entry excluding something no standard was going to claim is padding that makes the list look thorough and settles nothing.

A scope statement stays silent on a section the standard holds but should not own. Claiming it makes the statement false the moment the section moves, and the visible mismatch is the evidence that moves it.

A statement enumerating the parts of the artifact it governs carries the same list the shape rules carry, so a part added to one is added to both or the standard contradicts itself. `skill.md` names the skill folder's contents in its scope sentence and again under `## Structure`, and the eval sibling reached the second while the first still claimed five parts. Nothing compares the two, since the citation stage verifies that a path resolves rather than that two sentences agree, so the second enumeration is the cost of naming parts in a statement whose job is naming owners.

`publish.md` is the second occurrence and it shows the failure reaching a sibling. Its statement named the scan and the unreadable-source response, a cross-reference section landed among the shape rules with the enumeration unmoved, and `markdown.md` was given a `Does not govern:` entry yielding the rule at the same time. The yielding side then pointed at a standard whose own scope line claimed nothing, which is a both-sides boundary declared from one side and a half.

The first repair narrowed that gap rather than closing it, which is the part worth carrying. The claim went into the enumeration under a qualifier naming only outbound text while the section ruled on both destinations, so the repository half stayed yielded by one standard and claimed by neither. A standard writes its jurisdiction in three places, the frontmatter `description`, the enumeration of what the scope statement governs, and the sentence saying where the standard applies, so widening one and leaving the others reproduces the gap a line down. The repair took all three across as many passes, each finding the next surface the one before it had left behind.

The `description` is the surface to check last and the one that reaches furthest. It becomes the index link label on install, so it is rendered into the catalog of every tree the standard ships to and is the only one of the three a reader meets without opening the file.

The retired `prose.md` held the pre-publish scan on these terms until it gained a file of its own, which is the route worked once. `pr.md` still holds its testing-discipline rules and takes the same route next.

## How the scope statement is parsed

The scope statement is read by machine as well as by a person, which is what costs an author the two shape rules `standards/standard.md` now carries about it. The path goes in backticks in the first sentence, anchored deep enough to resolve from a project root, and an attribute standard says in that sentence that it governs an attribute.

Publishing the declaration was the alternative to widening the audit's hardcoded mapping, which bound three document types out of thirteen. The cost is that rewording a Governs line can break a consumer with no error in front of it, which is why an unreadable statement emits an empty array rather than a guess.

`standard.md` names `standards/`, which is the only tree the declaration has to match now that neither an install nor a mirror writes the corpus anywhere else.

A second consumer now reads the statement, the `standards` kind of the record validator, and it reads it on the same contract rather than on one of its own. Two readings of one sentence would let a standard pass the check while publishing a different jurisdiction to every consumer of the catalog, which is a disagreement no stage would report.

Every backticked token in that first sentence is read as a path, and the `*` resolution for an attribute standard fires only when the sentence carries none. A field name or a file extension backticked there is published as the standard's jurisdiction, so a consumer mapping a changed file through `appliesTo` matches nothing and reports the file clean.

`markdown.md` and the retired `prose.md` both shipped that way for one commit, emitting `.md` and `title,description`. An attribute standard therefore keeps its first sentence free of backticks and names the identifiers it governs in a later one.
