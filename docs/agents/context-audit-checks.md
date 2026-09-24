---
title: Context audit checks
description: What each non-gating check reports, the unit each checkpoint is measured in, the architecture record's length and entry cap gates and claim coverage, which folders each check reaches, and what moved to the attribute tier
---

# Context audit checks

What each finding from `canon context audit` means. The command surface, its flags, and the two gating checks are in `context-audit.md`.

## Required sections

The required-section check reports what does not declare the sections its folder's standard requires. A context entry owes `## Overview` and `## Layout`, the two sections `standards/context.md` marks required. A wireframe owes `## Regions`, `## States`, `## Copy`, and `## Not on this surface`, the sections answering the four questions `standards/wireframes.md` tests a surface against. `## Behavior` is expected of a wireframe rather than required, since a static surface has no interaction to state. The lists are held in code beside the numeric checkpoints rather than parsed out of the standard, so it fails on a defect rather than on a rewrite of the wording around it. A heading at any level counts, because a domain that split into a folder carries its overview in a sibling named `overview.md` where the section is the `#` title and an `##` beneath it would repeat the filename. Matching exactly is what keeps `## Layout catalog` from satisfying `Layout`.

Which unit answers depends on the folder. Entries of the folder named under `.claude/` are one domain each, so each answers for itself and a finding names the entry. Entries of a folder a domain split into describe that one domain between them, so any sibling answers and a finding names the folder. Holding a split folder to the rule per file would report every child beside its `overview.md`, and rolling the named folder up would let one conforming entry stand in for every other domain sitting next to it. A wireframe answers for itself in every folder, nested or not, since its standard keeps one surface per file and a subfolder of wireframes groups surfaces rather than splitting one.

It reports rather than gates by default, the closer call because a missing section reads more like a fact than the other judgments. What settles it is that the standard sanctions omitting `## Layout` from a domain owning no paths in the repo, and no measure separates that from an entry that forgot it. A domain covering only external tools is that case, and it reports on every run. The JSON record carries the findings as `missingSections`, the lists per folder name as `checkpoints.requiredSectionsByFolder`, and the context list alone as `checkpoints.requiredSections`, the flat key it carried before wireframes owed a section.

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

It reports and never gates, which the standard settles rather than the usual judgment-against-fact line: there is no hard cap, so an entry that answers all three and is still long is a correct outcome. The JSON record carries the joined findings as `length`, each with a `causes` array in the standard's order, and the jurisdiction the join reads as `entries[].governed`. That flag is what parts a provenance list measured and empty from one never scanned, which the count alone cannot say. The join is published rather than left to a consumer, since deriving it means restating which question the provenance count answers.

Depth and bullet weight are quoted from `standards/markdown.md`, which states both over every markdown file rather than over a context entry, so `canon markdown audit` measures them and this command no longer does. They share `renderedHeight` with the length measure, since the two checkpoints sit in one section of that standard and a reader compares them. What the split costs is that a session wanting both numbers for one entry runs two commands, and what it buys is that either number can be had for a file in a folder this audit refuses to resolve.

## Tables

The table check reports a catalog that grows a row per shipped thing, not a table count. A fixed comparison table never reflows, so its size costs nothing. A table qualifies at six or more body rows whose first column mostly carries a path, command, or link, which is what separates a catalog from a comparison without reading the prose. It stays here rather than moving with depth, because the shape it routes a catalog into is a judgment the context standard makes about an entry.

## Provenance

The provenance check reports the markers narrating how a domain reached its shape rather than describing what it is: a date, a change number, or a release label. The standard admits a rejected alternative and the reasoning that killed it while refusing the provenance attached to it, so a marker names a line to read rather than a line to delete. Findings group by entry and sort left to right within a line, since what a reader acts on is which file to open.

A change number matches at any digit count, so `PR #7` and `#49` report alongside a four-digit number. Displayed spans are masked before the match runs, which is what keeps a heading's own auto-derived link destination, `(#7-open-questions)`, and a hex color in a code span, `` `#000` ``, from reading as a change reference: both are text an entry shows rather than a claim it makes. <!-- canon-allow-reference: illustrates the input shape the rule reads -->

A date stamping a measurement is excluded, because the standard cuts a date attached to a change and permits one dating a figure. The check reads the clause in front of the date, back to the nearest sentence boundary, for one of five verbs: measured, verified, driven, passed, and fired. The noun `run` counts only where it sits against the date, so `A run on 2026-08-14` is excluded and `Runs on erclx/canon#632 and erclx/canon#634 landed 2026-08-02` reports. The set is closed, and a date it cannot place reports as a change marker rather than as a state of its own, which names one date too many rather than clearing one the rule cuts. <!-- canon-allow-reference: illustrates the input shape the rule reads -->

A release label reports with or without its leading `v` at three segments, since the rule cuts the label rather than a spelling of it. Two segments still need the `v`, which keeps a dollar cost and a duration out. Another tool's version reports too, and the check cannot tell one from a release, so treat a version beside a tool name as a line to read rather than one to cut.

Fenced blocks are excluded, which keeps a pinned version in an install command from reading as a claim the entry makes. Frontmatter is excluded with them, since the content checks read the body alone, and that is what keeps a diagram entry's dated `verified` stamp a record of its last check rather than a marker to settle. Length is the exception, counting the whole file, so a reader applying the 150-rendered-line checkpoint against the body alone lands a few lines under what the tool reports.

## Narration

The narration check reports a bullet that states the design a sibling bullet replaced instead of rewriting it. `standards/context.md` asks for the rewrite because the subject is still live and two bullets on one subject leave a reader to work out which of them is current, and no other measure sees that shape.

It reads structure rather than words, which the corpus decided. Measured across the 39 entries this toolkit held the day it shipped, the terms carrying clean signal for a supersession are too rare to catch anything: `superseded` appears twice, `previously` three times, and `formerly`, `originally`, and `at first` never. The one term that would have caught the case a review caught by hand is `now`, which appears 57 times across 24 entries in correct present-tense prose. A list including it reports 57 lines to catch one, and a list excluding it reports nothing.

What it matches instead is a bullet doing three things at once: opening with a pronoun whose antecedent is the bullet above it, carrying a past-tense verb, and following another top-level bullet. All three are required. Eight bullets in the corpus open with a back-reference, and the verb set narrows those to one.

The pronoun is matched cased and anchored to the opening, since a mid-sentence `this` is a determiner rather than a reference back. The verb is matched uncased anywhere in the bullet, and rejected when a copula sits in front of it, since `is used to resolve the folder` is the passive of `use` rather than the past habitual the set means.

Both sets are published under `## Narration pronouns` and `## Narration verbs` in a governance rule and read at run time, so widening either costs a rule edit rather than a TypeScript change. The copula list stays in code, because it is English grammar rather than corpus vocabulary and a rule publishing two of three headings would be another absent state to carry. Discovery keys on the headings rather than the filename, because rules are numbered and a renumber would empty the sets while the check kept reporting clean. A run finding no rule that publishes both says it scanned nothing rather than reporting clean.

A blank line does not end the run. Markdown reads the bullets around one as a single loose list, so a walker that broke there would leave the shape reachable by anyone who spaced their bullets out. What ends a run is content that is neither a bullet nor indented under one, which is what keeps the first bullet under a heading from reading as a reply to the last bullet above it.

A fence answers that test for itself, because every scan here skips a fenced line before reaching it. An unindented fence ends the run, since CommonMark reads one at column zero as interrupting the list and the bullets around it are then two lists with no antecedent crossing between them. A fence indented under its bullet stays inside the item and leaves the run intact.

The opening delimiter decides that for the whole block rather than each line deciding for itself. A blank line inside an indented fence carries no indentation to read, and a content line may sit at column zero inside one because CommonMark strips the fence's own indent and nothing further. Reading either as unindented ends a run that should have continued, which costs findings rather than inventing them, so no corpus count moves when it is wrong.

Two fenced blocks with nothing between them are one contiguous run of fenced lines, so the mark alone cannot say where the first ends. The line walker reports which block each line sits in, and the boundary re-reads indentation whenever that number changes, so an unindented block written directly behind an indented one ends the run rather than inheriting the answer above it. No markdown file this repository tracks holds that shape, because a formatter inserts a blank line between two fences on contact, and a target running these commands over an unformatted tree still can.

Precision is the whole value, so recall is the accepted exposure, and two shapes are knowingly out of reach. A narration written as one bullet carrying its own before and after slips through, and nothing else sees it either. So does the perfect passive, since `has been superseded` narrates a supersession and the copula guard rejects it with the passives it exists for.

A rejected alternative is a back-reference in the past tense by construction, and the standard keeps what was tried and why it lost, so a legitimate hit exists and no measure separates it from a violation. The report states that on every run, which is why the finding names a line to read rather than a line to delete.

The JSON record carries the findings per entry as `entries[].narration` and the sets as `checkpoints.narration`, which is absent under `--citations-only` where the run never loads them and null where no rule publishes both.

## The architecture record

Four findings read `canon/ARCHITECTURE.md` rather than a folder, and only the first two are facts.

The entry cap check counts the record's decisions against the cap it states for itself, in a clause of the form `This record holds at most 12 decisions.` Like the length check, the cap belongs to the record rather than to the toolkit, so a record stating none is measured and never gated. A decision is a `###` heading outside a fenced block, so the template a standard shows does not count, and a heading carrying two decisions counts once. The JSON record carries what it read as `architecture.entryCap`, absent where the record states no cap, and the audit catalog counts a record past it as `recordOverCount`.

The length check compares the record against the ceiling it derives for itself, and only a record that states its own allowances has one. No standard sets a length rule for this document, so the numbers belong to whichever record declares them. The check reads a frame allowance and an allowance per decision out of the record's own prose and puts the ceiling at the frame plus the allowance times the decision count. The JSON record carries what it read as `architecture.allowances` and the reading as `architecture.lines` against `architecture.ceiling`.

A record stating no such rule is measured and reported and never gated, which is the ordinary shape of a project that wrote an architecture record and no convention about its length. Holding a pair of numbers in the toolkit and gating every project against them would fail a record on a ceiling that project never agreed to, and the framed line would credit the rule to a file that does not state it.

What the derivation costs where it does apply is that the ceiling rises when a decision is added and falls for nothing, so the check passes exactly when the file grew. It gates anyway, because a record that states a limit for itself and makes it computable from a count has turned it into a fact, which is what separates it from every judgment below. A rewrite of the declaring sentence past the clauses the check reads falls back to reporting rather than to a stale ceiling, so the failure shows up in the run's own output.

The coverage report classifies each decision as carrying a countable claim, a structural invariant, or neither, then reports each testable entry against whether it names a check that exists. A countable claim carries a figure a run could recompute, and an invariant quantifies over a named tree closely enough that a walk could falsify it. A check is a `scripts/**.sh` path the entry spells that is on disk, or a `canon` invocation matching a registered audit, so coverage reads the entry rather than the tree and a claim some check happens to cover without the entry saying so reads as unchecked.

Three limits are stated on every run rather than hidden. The countable signal reads digits alone, so a measured claim written in words reads as uncounted. Entries are counted by heading, and one heading holding several decisions counts once. Nothing is stored, so an entry rewritten tomorrow is classified afresh the next time the verb runs and no verdict goes stale.

The report gates nothing. Deciding whether a sentence states a claim is a judgment no parser settles, so the output names candidates for a reader. This answers a different question from the verification anchors `standards/architecture.md` describes, which record that one cited number was re-read. That mechanism says whether a marked figure held, and this one says how much of the record could be checked at all.

The third finding is a word count, measured in words rather than lines: one figure for the whole record and one per decision. `standards/architecture.md` asks a session to judge the file's weight by reading it rather than by counting it, and reads the word figure alongside that judgment when one is available. A paragraph written one source line to a paragraph passes the rendered-line measure other checks use while still reading heavy, which is the gap a word count closes without turning into a second cap.

The `## Risks / open questions` section is weighed the same way, reported apart from the whole-record figure since the standard singles it out for holding only what is still open. This finding gates nothing under any mode. The JSON record carries the whole-record figure as `architecture.words`, the section figure as `architecture.risksWords` where the record carries the heading, and the per-decision figure as `architecture.decisions[].words`.

## Wireframe states

Every entry under `canon/wireframes/` carrying a `## States` table is checked against its evidence folders on disk. `State` and `Evidence` are matched by header text rather than column position, since the standard's own template could still move a column during its own review. An entry with no such table is out of scope and reports nothing.

An evidence cell's path is read as written and resolved against the project root, since the standard puts the path in the cell rather than a state name a convention would have to guess at. A state whose cited path resolves to no directory is a missing folder, measured in states: one finding per row. A directory sitting under a root at least one row already cites, but named in no row itself, is an unlisted folder, measured in folders: one finding per directory.

Both are counted rather than only listed, since a count is what a reader compares run to run. A `not captured` cell is the one value the standard exempts from having a folder, and it drops out of both counts.

The third finding reads the whole entry rather than one row: whether it carries a `plaintext`-fenced sketch while a state's evidence already exists on disk. The standard asks the fence to come out the moment a layout has a capture to show instead, so a sketch surviving past that point is a boolean per entry rather than a count.

The unit here is the entry rather than the layout the standard's own rule is stated against. A table names states, not the layouts a wireframe's `## Regions` section can split into at a breakpoint, so this finding has no narrower unit to match a sketch against the evidence for its own layout alone. An entry with a captured default layout and a sketch for a breakpoint layout that is not built yet is conforming, and this finding still reports it, which is why it stays advisory under every mode rather than joining the states-mismatch gate below.

All three wireframe findings are printed under a bare run. The states-mismatch finding, missing and unlisted folders together, gates at `2` under `--gate`, alongside a missing required section and index drift. The sketch finding stays advisory under both modes, for the reason above. The JSON record carries them per entry under `wireframes[]`, as `rows`, `missingFolders`, `unlistedFolders`, and `sketchWithEvidence` alongside `sketchLine`.

## Which folders each check reaches

The provenance and narration checks cover `canon/context/` alone, the reference-form check covers the split folders inside it, the required-section check covers `canon/context/` and `canon/wireframes/`, length and the table finding reach every audited folder, and the wireframe states check covers `canon/wireframes/` alone.

What narrows the first two is stated in `standards/context.md`, which opens its scope by handing diagrams and wireframes to `diagrams.md` and `wireframes.md`, and the sibling standards do not restate it. A marker reported in a diagram entry would cite a rule that entry's own standard routes elsewhere, and a diagram entry carries a heading per kind rather than a run of bullets deciding anything. The split is between kinds of rule rather than kinds of folder, and what decides it is which tier states the rule rather than what the check measures.

Length and the table finding generalize as judgments about how far a reader travels, so both reach wherever the audit is pointed. Required sections narrow for a plainer reason: each list is one standard's own, so it reaches the folder that standard governs. The context and wireframe standards each state a set, and the diagram standard states none.

The same test is what moved depth and bullet weight out of this command entirely. A rule stated at the attribute tier reaches every markdown file, and a check reaching every markdown file has no reason to require a folder that resolves.

The scoping key is the folder an entry was audited under, so `--folder` still reaches a folder the default list does not carry, and a domain split into `context/<sub-area>/` is governed as `context`. Every run states the reach, including a run where no audited folder is the governed one. The JSON record carries it as `checkpoints.provenanceFolder` and a per-folder `governsContent`.

## Index drift

Index drift compares an index against its siblings in both directions. An entry the index does not link is invisible to a session choosing what to open, and a linked name resolving to nothing sends one to a path that opens nothing.
