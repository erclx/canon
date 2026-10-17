---
title: Context audit measures
description: How the length, depth, provenance, and reference-form measures count, and the requirements record measured beside the folders
---

# Context audit measures

## Decisions

### Length counts rendered lines

The length measure counts rendered lines at 80 columns, the unit the depth checkpoint uses. Entries are authored one line per bullet, so fifteen paragraph-bullets occupy fifteen source lines and render past sixty, which source counting cannot see.

The two measures share `renderedHeight` across the domain boundary, since they sit in one section of the standard and a reader compares them.

### Rendered and source counts part

The helper measures what renders, so a link counts as its anchor text and a code span is counted whole. The rendered count parts from a source count wherever an entry cites a path in backticks rather than as a link. The audit measured 60 entries, 51 under `canon/context/` and 9 under `.canon/diagrams/`.

### One result per entry

`longestRun` in `src/context/audit.ts` keeps one result per entry, so a file with two blocks past the depth checkpoint reports the longer and hides the rest. A task scoped from the report is a floor rather than the set.

- Reuse the audit's own exclusions for fenced blocks and the peer-list exemption so the numbers match
- Re-measure after each entry

### Fences differ between the two measures

The run measure skips a fence so an example cannot break the run around it, and the file measure has no run to protect. Excluding fences from the file measure was dropped, since the entry it would serve runs 20 percent fenced and stays past the checkpoint either way.

Nothing sets a line width, so each legend states the one the report used.

### The length finding carries three questions

Past the checkpoint the finding carries the three questions the standard asks, not the count alone, since a count says nothing a reader can act on. Only accumulated history is mechanical, so `lengthFindings` joins the provenance count measured beside it and leaves the other two open.

- Whether an entry still covers one domain is a judgment about its subject
- Recognizing content `ls` or `--help` reproduces needs a reader who knows what those emit
- A stated cause the tool inferred would be worse than an open question, since a wrong cause sends the fix at the wrong half of the entry

An entry outside the governed folder reads open on all three. Provenance is scoped to the standard stating it, so an empty marker list there is a scan that never ran, and `no` would report a clean history against nothing measured.

### Narrow a check where it measures

Scoping belongs in `measureFolders`, not in `reportProvenance`. Filtering at the print step would have left every `entries[].provenance` array in the `--json` record populated for the two folders the rule stopped governing, and applying it at measurement keeps both surfaces agreeing.

### The marker separates two kinds of date

A date attached to a change is cut by the standard. A date stamping a measurement is not, since it is the anchor the entry's figures are tested for staleness against.

Anchoring to a commit was rejected. It is exact only where the recording commit is the tree the figure was read against, which blame shows is often not the case.

### The marker reads the clause

Five verbs stamp a measurement wherever they sit in the clause, being measured, verified, driven, passed, and fired. The noun form counts only where it sits against the date, since a clause naming the noun at any distance would clear the second line below along with the first.

```markdown
A run on 2026-08-14 passed at 5 asserted and 0 failed.
Runs on #632 and #634 landed 2026-08-02.
```

- The clause ends at the nearest sentence boundary, so a measurement recorded beside a change does not clear it
- A date the set cannot place stays the change marker, reporting one date too many rather than clearing one the standard cuts
- The example sits in a fence for the reason the check excludes one, so an entry teaching the marker does not report every literal it quotes

### The release pattern

The pattern matches three segments with a leading `v` optional, since the standard cuts a release label rather than a spelling of one. Two segments still require the `v`, because an unprefixed pair in this corpus is a dollar cost or a duration far more often than a release.

The widening reaches another tool's version by accident. Those report rather than being excluded, since an exclusion keyed on a nearby tool name goes stale with nothing saying so.

### The split runs on the date kind alone

A version stamping a measurement reports where a date stamping the same one does not. Both lines below come back as release markers under clauses the date pattern reads as anchors.

```markdown
The wrapper masks a refusal exactly as it masks an absent verb, measured against 0.98.0.
Bun exits 1 on the same throw with no pipe attached, measured on Bun 1.3.14.
```

That asymmetry is what accepting a dependency version costs. Closing it means running the stamping clause over the release kind rather than widening either pattern.

### Reference form is a second pass

The reference-form match is separate from `citationPattern`. A spelled path is a reference by construction, and a bare name is a candidate the caller must test against the folder it sits in, so one expression would answer two questions at once.

The ignore marker is shared, since both checks ask whether a line points at a file and the marker is how a line says it displays a name.

### The provenance marker over-reports on purpose

The marker matches a version-like or date-like token anywhere outside a fence, so two shapes that narrate no change still report. One is a fixture literal an entry quotes because the fixture stages that label. The other is a version string illustrating a pattern some other matcher must not misread.

Name the property rather than the literal, which clears both and keeps what the sentence taught. A date stamping a measurement clears the same way when the measured artifact's own version pins already sit in the surrounding prose.

### The requirements record

`canon/REQUIREMENTS.md` is measured beside the folders rather than by its own command. The record is a context surface and this verb already sits in the audit catalog, while a new top-level registration would touch `src/cli.ts` for no reason specific to this check.

The accepted cost is a requirements check under a verb named for context folders, and moving it later renames a command surface.

### The word cap comes from the record

`readRequirementsWordCap` reads an `at most <n> words` clause out of the record's own prose, so a record stating none is measured and never gated. A cap held in code would audit every target against a rule it never adopted, the failure `canResolveAtRoot` answers on the folder side.

### One audit row

The measure reaches `canon audits run` through the existing `context` row, since a second row spelling the same argv walks the whole tree twice for numbers the first record carries. A project entitled to carry no record contributes no key rather than a zero, which would read as a conforming record.
