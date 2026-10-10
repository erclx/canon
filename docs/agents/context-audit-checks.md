---
title: Context audit checks
description: What each non-gating check reports, the unit each checkpoint is measured in, the requirements record's word cap, which folders each check reaches, and what moved to the attribute tier
---

# Context audit checks

What each finding from `canon context audit` means. The command surface, its flags, and the two gating checks are in `context-audit.md`.

## Required sections

The required-section check reports what does not declare the sections its folder's standard requires. A context entry owes `## Overview` and `## Layout`, the two sections `standards/context.md` marks required. The lists are held in code beside the numeric checkpoints rather than parsed out of the standard, so it fails on a defect rather than on a rewrite of the wording around it. A heading at any level counts, because a domain that split into a folder carries its overview in a sibling named `overview.md` where the section is the `#` title and an `##` beneath it would repeat the filename. Matching exactly is what keeps `## Layout catalog` from satisfying `Layout`.

Which unit answers depends on the folder. Entries of the folder named under `.claude/` are one domain each, so each answers for itself and a finding names the entry. Entries of a folder a domain split into describe that one domain between them, so any sibling answers and a finding names the folder. Holding a split folder to the rule per file would report every child beside its `overview.md`, and rolling the named folder up would let one conforming entry stand in for every other domain sitting next to it.

It reports rather than gates by default, the closer call because a missing section reads more like a fact than the other judgments. What settles it is that the standard sanctions omitting `## Layout` from a domain owning no paths in the repo, and no measure separates that from an entry that forgot it. A domain covering only external tools is that case, and it reports on every run. The JSON record carries the findings as `missingSections`, the lists per folder name as `checkpoints.requiredSectionsByFolder`, and the context list alone as `checkpoints.requiredSections`, the flat key it carried first.

`--gate` promotes the finding to a failing exit code, which the seed stage runs and no other caller does. That mode needs an answer to the sanctioned omission above, so a file declaring `stub: true` in its frontmatter is dropped before the check and reported nowhere. Both are described in `context-audit.md`.

## Reference form

The reference-form check reports an entry naming a sibling entry by bare filename where `standards/context.md` asks for the path it sits at. A bare name resolves against whichever folder its reader is already in, so a domain that splits into subfolders strands every inbound reference and the break surfaces nowhere. A path is checkable, which is what makes the form rule worth measuring at all: once a reference spells its path, the citation gate resolves it and a split that moves the file fails the push.

A finding is a backticked filename carrying no folder, matched against the entries beside the one that wrote it. The backticks are required, since a filename in running prose is not a reference a reader follows.

A name matching no sibling is left alone, which is the measure reaching less than the rule does rather than the rule stopping there. The standard governs a reference to any other entry, so a split entry naming one that sits in a different folder is a violation this check never sees. What the sibling set buys is that a name resolving inside the folder is a reference by construction, where a bare filename matched anywhere would report every sentence that happens to name a file.

An entry naming itself is left alone on separate grounds, since no split can strand it. Fenced blocks are excluded with the scans above, and a line carrying the citation ignore marker is excluded because that marker already means the line displays a name rather than pointing at one.

The check covers the folders a domain split into and stops at the flat folder above them. A split folder's entries are named for sub-areas of one domain, so a bare name matching one of them points at it. The flat folder's entries are named for whole domains, and a domain name is a common noun that a seed or another tree spells the same way, which is where both false positives measured against this corpus sat. What the exemption costs is the references a future split of the flat folder would strand, and it is taken because a report firing on correct prose teaches a reader to stop reading the section.

It reports and never gates, which is the split the citation check already draws. An unresolved path is a fact and a form violation is a judgment with a measured false-positive rate, the same line `canon markdown audit` draws between a ban and a weight checkpoint. The JSON record carries the findings per entry as `entries[].bareReferences`.

## Length

Length quotes its checkpoint from `standards/context.md`: roughly 150 rendered lines for an entry, applied to each of the 60 entries the audit measures, 51 of them under `canon/context/` and 9 diagram files beside them. It counts rendered lines rather than source lines, wrapping each line at 80 columns and summing the heights.

A line is wrapped at the width it renders at, so a link counts as its anchor text and a backticked path counts whole, which parts the rendered count from a source count wherever an entry cites a path in backticks rather than as a link. Entries here are authored one line per bullet, so a block of fifteen paragraph-bullets occupies fifteen source lines and renders past sixty, which source counting cannot see.

The measure counts fenced blocks and frontmatter, so a reference-heavy entry ranks by its examples, which the legend states on every run alongside the width, since a number in rendered lines cannot be reproduced without it.

Every entry past the checkpoint carries the three questions the standard asks of it rather than a count alone: whether it still covers one domain, whether it has filled with content `ls` or `--help` reproduces, and whether it has accumulated the history of its own changes. The checkpoint is not a cap, so the count is not the finding. What a reader acts on is which question came back true, and the standard directs the fix at that rather than at the number.

Only the third is mechanical, and it is the provenance check already reported below, so the length finding cites that count rather than measuring it again. What it cites is a count of change markers, which is why an entry recording what its own runs cost answers `no` there while carrying dates throughout. An entry outside the governed folder reads open there too, since provenance is scoped to the standard stating it and a clean list there is a scan that never ran. The other two stay open beside every entry, because whether a domain is still one domain is a judgment about its subject and recognizing reproduced content needs a reader who knows what those commands emit. Omitting them would read as an entry nothing found rather than one nothing checked.

It reports and never gates, which the standard settles rather than the usual judgment-against-fact line: the 150 checkpoint is diagnostic, so an entry that answers all three and is still long is a correct outcome. The one hard cap is the 300-line whole-document ceiling, which `canon markdown audit` and the Document ceiling gate stage read rather than this check. The JSON record carries the joined findings as `length`, each with a `causes` array in the standard's order, and the jurisdiction the join reads as `entries[].governed`. That flag is what parts a provenance list measured and empty from one never scanned, which the count alone cannot say. The join is published rather than left to a consumer, since deriving it means restating which question the provenance count answers.

Depth and bullet weight are quoted from `claude/skills/markdown-craft/references/markdown.md`, which states both over every markdown file rather than over a context entry, so `canon markdown audit` measures them and this command no longer does. They share `renderedHeight` with the length measure, since the two checkpoints sit in one section of that standard and a reader compares them. What the split costs is that a session wanting both numbers for one entry runs two commands, and what it buys is that either number can be had for a file in a folder this audit refuses to resolve.

## Tables

The table check reports a catalog that grows a row per shipped thing, not a table count. A fixed comparison table never reflows, so its size costs nothing. A table qualifies at six or more body rows whose first column mostly carries a path, command, or link, which is what separates a catalog from a comparison without reading the prose. It stays here rather than moving with depth, because the shape it routes a catalog into is a judgment the context standard makes about an entry.

## Provenance

The provenance check reports the markers narrating how a domain reached its shape rather than describing what it is: a date, a change number, or a release label. The standard admits a rejected alternative and the reasoning that killed it while refusing the provenance attached to it, so a marker names a line to read rather than a line to delete. Findings group by entry and sort left to right within a line, since what a reader acts on is which file to open.

A change number matches at any digit count, so `PR #7` and `#49` report alongside a four-digit number. Displayed spans are masked before the match runs, which is what keeps a heading's own auto-derived link destination, `(#7-open-questions)`, and a hex color in a code span, `` `#000` ``, from reading as a change reference: both are text an entry shows rather than a claim it makes. <!-- canon-allow-reference: illustrates the input shape the rule reads -->

A date stamping a measurement is excluded, because the standard cuts a date attached to a change and permits one dating a figure. The check reads the clause in front of the date, back to the nearest sentence boundary, for one of five verbs: measured, verified, driven, passed, and fired. The noun `run` counts only where it sits against the date, so `A run on 2026-08-14` is excluded and `Runs on erclx/canon#632 and erclx/canon#634 landed 2026-08-02` reports. The set is closed, and a date it cannot place reports as a change marker rather than as a state of its own, which names one date too many rather than clearing one the rule cuts. <!-- canon-allow-reference: illustrates the input shape the rule reads -->

A release label reports with or without its leading `v` at three segments, since the rule cuts the label rather than a spelling of it. Two segments still need the `v`, which keeps a dollar cost and a duration out. Another tool's version reports too, and the check cannot tell one from a release, so treat a version beside a tool name as a line to read rather than one to cut.

Fenced blocks are excluded, which keeps a pinned version in an install command from reading as a claim the entry makes. Frontmatter is excluded with them, since the content checks read the body alone, and that is what keeps a diagram entry's dated `verified` stamp a record of its last check rather than a marker to settle. Length is the exception, counting the whole file, so a reader applying the 150-rendered-line checkpoint against the body alone lands a few lines under what the tool reports.

## The requirements record

The audit reads `canon/REQUIREMENTS.md` under its own step rather than as a folder, and counts every word below the frontmatter against the cap the record states in a clause of the form `This record holds at most 600 words.` The cap is the record's own, so a record stating none is measured and never gated, and a project with no record is reported as out of scope. The seeded record states the 600-word cap. The JSON record carries the reading as `requirements`, null where the project carries no record and absent under `--citations-only`, and the audit catalog counts a record past its cap as `requirementsOverWords`.

## Which folders each check reaches

The provenance check covers `canon/context/` alone, the reference-form check covers the split folders inside it, the required-section check covers `canon/context/` alone, and length and the table finding reach every audited folder.

What narrows the provenance check is stated in `standards/context.md`, which opens its scope by handing figures to the `draft-figure` skill, and the sibling standards do not restate it. A marker reported in a diagram entry would cite a rule that entry's own standard routes elsewhere. The split is between kinds of rule rather than kinds of folder, and what decides it is which tier states the rule rather than what the check measures.

Length and the table finding generalize as judgments about how far a reader travels, so both reach wherever the audit is pointed. Required sections narrow for a plainer reason: each list is one standard's own, so it reaches the folder that standard governs. The context standard states a set, and an older install's diagrams folder has no standard to state one.

The same test is what moved depth and bullet weight out of this command entirely. A rule stated at the attribute tier reaches every markdown file, and a check reaching every markdown file has no reason to require a folder that resolves.

The scoping key is the folder an entry was audited under, so `--folder` still reaches a folder the default list does not carry, and a domain split into `context/<sub-area>/` is governed as `context`. Every run states the reach, including a run where no audited folder is the governed one. The JSON record carries it as `checkpoints.provenanceFolder` and a per-folder `governsContent`.

## Index drift

Index drift compares an index against its siblings in both directions. An entry the index does not link is invisible to a session choosing what to open, and a linked name resolving to nothing sends one to a path that opens nothing.
