---
title: Scope model
description: Which tree a standard lives in, what its scope statement declares, when a standard splits, and how the statement is parsed
---

# Scope model

A standard answers two questions before it answers anything about its own shape: which of the three authoring trees it belongs in, and what jurisdiction it claims once it is there. Both are checkable from outside the file, which is why the parser reading the scope statement constrains how that statement is written.

## Which tree a standard lives in

The root, `standards/`, is the authoring source with no consumed copy beneath it. Standards are uniform across every project, with no stack variation and no extends chain, so nothing resolves at install time. `canon/context/standards/resolution.md` carries the roots a reader resolves against.

A convention governing a surface only the toolkit has lives in `internal/standards/`, a tree no CLI entry point and no plugin symlink reads. Location is what enforces the boundary, so nothing has to remember to exclude it.

A convention consumed by a specific skill rather than authored by a project lives in the flat root like every other standard, cited through `${CLAUDE_SKILL_DIR}/../../standards/<name>.md`. `canon/ARCHITECTURE.md` records why a narrow-readership convention still belongs there rather than in a folder of its own.

A procedure several skills execute mid-run gets a standard of its own in the flat root rather than a section inside whichever standard already held one of its rules, since install and the sync adapter walk the flat root only. `standards/publish.md`, `standards/slug.md`, and `standards/session.md` are the three, each cited from every body that runs it and each taking the one-word name every installable standard carries. `session.md` also governs a document, `.canon/tasks/session-<slug>.md`, which puts it in the flat root on two counts, and it reaches a session holding no skill at all, since a compaction routes to the skill before it routes to the file.

A standard's name follows the artifact's own path segment: `plan.md` over `.canon/plans/feature-<slug>.md`, `memory.md` over `.canon/memory/<type>-<slug>.md`, and `session.md` over `.canon/tasks/session-<slug>.md`. `handoff.md` is the rejected name for the third, since this corpus already calls a `Does not govern:` pointer a scope handoff and `groundwork.md` already calls its own last file the handoff, so the one word would name three artifacts across three standards.

The derivation is stated in `standards/standard.md` under `## Scoping rules` and checked by `canon records validate standards`, keyed on the derivation rather than on word count: one word is the output across every authored standard, and a count-only check would pass a conforming single word naming the wrong artifact.

The check derives from the scope statement, so it inherits every constraint `## How the scope statement is parsed` records below. An attribute standard is exempt because it governs no path, a statement anchoring nothing is reported rather than passed, and a finding on a name says what the rename reaches, since the hero frame lists standards by name and a row moves whether or not a count does.

## What a standard declares

A standard states its rule and never what enforces it here. These files install into projects whose hooks, scratch paths, and skill catalogs are their own, so a rule justified by this repository's audit hook or illustrated with this catalog's output filenames is wrong in a target and nothing reports it. Name the general condition and let the consuming surface name its own case.

That prohibition runs one direction only. A path-scoped rule may carry the operative directives of the standard it points at, since the rule arrives attached to the edit while a pointer reaches a session only if that session opens the file. The standard keeps the full specification and the rule keeps what a session must have on arrival, so a drift is a rule falling behind rather than two files disagreeing. Nothing checks it.

The rule pointing at `markdown.md` may carry operative directives like any other, since the three ban sets it enforces ship as package data `canon markdown audit` reads rather than as prose a rule would otherwise restate.

`500-prose` stays pointer-only on a different argument. What it routes to is the `write-human` skill rather than a standard, and the guidance there is judgment stated across a body and three references, so a rule reproducing part of it would ship the compressible half and leave the half that does the work behind. The rule loads on the glob and carries an explicit instruction to load the skill, so the instruction arrives with certainty and what follows is an instruction being followed rather than a description being matched.

The rule that a standard states its own jurisdiction and never restates its enforcement lives in `standards/standard.md` under `## Scoping rules`, routed to every standards edit by `591-standard-authoring`. Audit the whole corpus for a violation of it rather than only the files a given change touches, since a pass scoped to one plan's file list leaves the rest reading clean.

Every standard declares its own jurisdiction in a `## Scope` section, above the shape rules. A standard that specifies shape exhaustively and jurisdiction nowhere cannot refuse a rule, so a rule with no obvious owner lands in whichever standard sits nearest and the corpus grows by annexation.

No single step has to look wrong for a standard to reach a second owner's rules, which is why the statement is what a step fails against. A sibling `REQUIREMENT.md` per standard would only restate what a standard already is, since a standard is a specification and a skill body is not.

A scope statement declares its boundaries from both sides. A yield, an exemption, or a handoff written into one standard alone is never read by the standard on the other side of it. Both halves are cheap to write and only the pair is checkable.

## When a standard splits

A standard splits when one half is machine-checkable and the other is a read a session either performs or does not. `markdown.md` carries every ban a command measures: headings, lists, code spans, punctuation, emphasis, file references, language, and frontmatter wording. Voice, rhythm, and information density go to the `write-human` skill, which a markdown edit routes to.

Scoping the audit tighter inside one file is the alternative, and it leaves the enforceable rules reading as advice, which is the defect the split avoids.

## The scope statement

A jurisdiction exclusion is not a content exclusion. `## Scope` names a concern an owner outside this standard holds, and `## What does not go in` names what does not belong inside the document. Only a bullet naming an owner belongs in the first. Merging the two puts a boundary claim where no sibling will read it.

Every `Does not govern:` entry names an owner, and an entry with no owner is cut rather than written. The owner is usually a sibling standard and may be another surface, a coding rule, a project policy, or the code itself. An entry excluding something no standard was going to claim is padding that makes the list look thorough and settles nothing.

A scope statement stays silent on a section the standard holds but should not own. Claiming it makes the statement false the moment the section moves, and the visible mismatch is the evidence that moves it.

A statement enumerating the parts of the artifact it governs carries the same list the shape rules carry, so a part added to one is added to both or the standard contradicts itself. `skill.md` names the skill folder's contents in its scope sentence and again under `## Structure`. Nothing compares the two automatically, since the citation stage verifies that a path resolves rather than that two sentences agree, so the second enumeration is the cost of naming parts in a statement whose job is naming owners.

A standard writes its jurisdiction in three places: the frontmatter `description`, the enumeration of what the scope statement governs, and the sentence saying where the standard applies. Widening one and leaving the others reproduces the gap the citation stage cannot see, since it checks that a path resolves rather than that the three agree. `publish.md` carries this shape today: its statement names the scan and the unreadable-source response, and `markdown.md` carries the `Does not govern:` entry yielding the pre-publish scan to it.

The `description` is the surface with the most reach. It becomes the index link label on install, so it is rendered into the catalog of every tree the standard ships to and is the only one of the three a reader meets without opening the file.

`pr.md` holds its own testing-discipline rules on the same terms.

## How the scope statement is parsed

The scope statement is read by machine as well as by a person, which is what the two shape rules `standards/standard.md` carries about it enforce. The path goes in backticks in the first sentence, anchored deep enough to resolve from a project root.

Every backticked token in that first sentence is read as a path, and the `*` resolution for an attribute standard fires only when the sentence carries none, so an attribute standard keeps its first sentence free of backticks and names the identifiers it governs in a later one. A field name or a file extension backticked there would publish as the standard's jurisdiction, and a consumer mapping a changed file through `appliesTo` would match nothing and report the file clean.

Publishing the declaration is the alternative to a hardcoded mapping in the audit binding each document type by name. The cost is that rewording a Governs line can break a consumer with no error in front of it, which is why an unreadable statement emits an empty array rather than a guess.

`standard.md` names `standards/`, the only tree the declaration has to match, since neither an install nor a mirror writes the corpus anywhere else.

A second consumer reads the statement, the `standards` kind of the record validator, on the same contract rather than one of its own. Two readings of one sentence would let a standard pass the check while publishing a different jurisdiction to every consumer of the catalog, which is a disagreement no stage would report.
