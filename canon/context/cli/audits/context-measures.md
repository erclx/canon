---
title: Context audit measures
description: How the length, depth, provenance, and reference-form measures count, and the architecture record measured beside the folders
---

# Context audit measures

## How the measures count

The length measure counts rendered lines at 80 columns, the unit the depth checkpoint uses in the sibling command. Entries are authored one line per bullet, so a block of fifteen paragraph-bullets occupies fifteen source lines and renders past sixty, which source counting cannot see. The two share `renderedHeight` across the domain boundary rather than each keeping a count of its own, since they sit in one section of the standard and a reader compares them.

That shared helper measures what renders, so a link counts as its anchor text in both and a code span is counted whole. The rendered count therefore parts from a source count wherever an entry cites a path in backticks rather than as a link, across the 60 entries the audit measures, 51 of them under `canon/context/` and 9 under `.canon/diagrams/`.

`longestRun` in `src/context/audit.ts` keeps one result per entry, so a file carrying two blocks past the depth checkpoint reports the longer one and hides the rest, which makes a task scoped from the report a floor rather than the set: a shorter run can sit behind a longer run in the same file and go unreported until the longer one clears. Reuse the audit's own exclusions for fenced blocks and the peer-list exemption so the numbers match, and re-measure after each entry.

The two measures still exclude different things, since the run measure skips a fence so an example cannot break the run around it and the file measure has no run to protect. Excluding fences from the file measure was weighed and dropped, because the corpus entry it would serve runs 20 percent fenced and stays past the checkpoint either way. Nothing here sets a line width, so each legend states the one the report used rather than leaving the number unreproducible.

The length finding carries the three questions the standard asks past the checkpoint rather than the count alone, since the checkpoint is not a cap and a count says nothing a reader can act on. Only accumulated history is mechanical, so `lengthFindings` joins the provenance count already measured beside it and leaves the other two open. Measuring them was the alternative and neither is reachable: whether an entry still covers one domain is a judgment about its subject, and recognizing content `ls` or `--help` reproduces needs a reader who knows what those commands emit. A stated cause the tool inferred would be worse than an open question, because a wrong cause sends the fix at the wrong half of the entry.

An open state is carried rather than omitted, and an entry outside the governed folder reads open on all three. Provenance is scoped to the standard stating it, so an empty marker list there is a scan that never ran, and answering `no` from it would report a clean history against nothing measured.

Narrowing what a check covers belongs where the measurement runs, not where it prints. The provenance plan named `src/commands/context.ts` as the file to scope, and filtering inside `reportProvenance` would have left every `entries[].provenance` array in the `--json` record populated for the two folders the rule stopped governing. Applying it in `measureFolders` is what keeps the two surfaces agreeing.

The marker separates a date attached to a change from a date stamping a measurement. The standard cuts the first and says nothing against the second, since a date on a run is the anchor its own figures are tested for staleness against, and an entry reading a ceiling off a dated figure would be left with a number nothing could date. Anchoring to a commit was the alternative and it is exact only where the recording commit is the tree the figure was read against, which blame shows is often not the case, so a sha there would date a number to a tree it never met.

The marker reads the clause in front of the date rather than the token alone. Five verbs stamp a measurement wherever they sit in the clause, being measured, verified, driven, passed, and fired. The noun form counts only where it sits against the date, since the two shapes below differ in nothing else, and a clause naming the noun at any distance would clear the second along with the first:

```markdown
A run on 2026-08-14 passed at 5 asserted and 0 failed.
Runs on #632 and #634 landed 2026-08-02.
```

The clause ends at the nearest sentence boundary, so a measurement recorded beside a change does not clear it. A date the set cannot place stays the change marker it was, which reports one date too many rather than clearing one the standard cuts, and the length finding spends no third state on it. The example above sits in a fence for the reason the check excludes one: an entry teaching the marker would otherwise report every literal it quotes.

The release pattern matches three segments with a leading `v` optional, because the standard cuts a release label rather than a spelling of one. Two segments still require the `v`, since an unprefixed pair in this corpus is a dollar cost or a duration far more often than a release. What the widening reaches by accident is another tool's version, which no rule asks anyone to cut, and those report rather than being excluded: an exclusion keyed on a nearby tool name goes stale with nothing saying so.

The split runs on the date kind alone, so a version stamping a measurement reports where a date stamping the same one does not. Both lines below come back as release markers, under clauses the date pattern reads as anchors:

```markdown
The wrapper masks a refusal exactly as it masks an absent verb, measured against 0.98.0.
Bun exits 1 on the same throw with no pipe attached, measured on Bun 1.3.14.
```

That asymmetry is what accepting a dependency version costs, taken over an exclusion keyed on a nearby tool name, and closing it means running the stamping clause over the release kind rather than widening either pattern.

The reference-form match is a second pass rather than a widened `citationPattern`. One expression admitting both forms puts a single match in the position of answering two questions, since a spelled path is a reference by construction and a bare name is a candidate the caller still has to test against the folder it sits in. The ignore marker is shared instead of duplicated, because both checks ask whether a line points at a file and the marker is already how a line says it displays a name.

The provenance marker matches a version-like or date-like token anywhere outside a fence, so two shapes that narrate no change still report. One is a fixture literal an entry quotes because the fixture stages that exact label, and the other is a version string illustrating a pattern some other matcher must not misread. Naming the property rather than the literal clears both while keeping what the sentence taught, which is the remedy the reported-rather-than-gated framing leaves open. A date stamping a measurement clears the same way when the measured artifact's own version pins already sit in the surrounding prose, since those date the measurement more precisely than a calendar does.

## The architecture record

`canon/ARCHITECTURE.md` is measured beside the folders rather than by a command of its own. The record is a context surface and this verb already sits in the audit catalog, while a new top-level registration would touch `src/cli.ts` for no reason specific to this check. The accepted cost is an architecture check under a verb named for context folders, and moving it later renames a command surface.

The ceiling comes from the record being measured rather than from a standard or from code. `standards/architecture.md` sets no length rule, so the allowances belong to whichever record declares them, and `readAllowances` reads a frame clause and a per-decision clause out of that record's own prose. The ceiling is then the frame plus the allowance times the decision count. A record declaring neither is measured and never gated, which is the ordinary shape of a target: holding a pair in code and gating every project against it audits a target against a rule it never adopted, the same failure `canResolveAtRoot` answers on the folder side. What the derivation costs is that the gate rises when a decision is added and falls for nothing, so it passes exactly when the file grew, and a rewrite of the declaring sentence past those clauses falls back to reporting rather than to a stale ceiling nobody can point at.

Each decision is then classified as carrying a countable claim, a structural invariant, or neither, and every testable entry is reported against whether it names a check that exists. A countable claim carries a figure a run could recompute and an invariant quantifies over a named tree within six words of it, both orders matched. The countable signal reads digits alone: admitting a cardinal spelled in words classified 22 of 24 entries as countable, because `one` in this prose is pronominal far more often than measured, and the cost of the narrower rule is that a measured claim written in words reads as uncounted.

Coverage reads the entry rather than the tree. A check is a `scripts/**.sh` path the entry spells that exists on disk, or a `canon` invocation matching an argv registered in `src/audits/catalog.ts`, so a claim some check happens to cover without the entry naming it reads as unchecked. Nothing is stored: every run reclassifies, so an entry rewritten tomorrow is read as it stands then and no verdict ages the way an anchor does. The classification gates nothing, since deciding whether a sentence states a claim is a judgment no parser settles, and counting entries by heading undercounts by at least two, which the report states rather than parses for.

The three measures reach `canon audits run` through the existing `context` row rather than a row of their own, because a second row spelling the same argv walks the whole tree twice for numbers the first record already carries. A project entitled to carry no record contributes no key rather than a zero, which would read as a conforming record, and the record key absent entirely reads as a shape that moved.
