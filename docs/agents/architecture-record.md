---
title: Architecture record
description: The four findings canon context audit reads off the architecture record, being the entry cap and length gates the record states for itself, the claim coverage report, and the word counts
---

# Architecture record

Four findings from `canon context audit` read `canon/ARCHITECTURE.md` rather than a folder, and only the first two are facts. The other checks the audit runs are in `context-audit-checks.md`.

The entry cap check counts the record's decisions against the cap it states for itself, in a clause of the form `This record holds at most 12 decisions.` Like the length check, the cap belongs to the record rather than to the toolkit, so a record stating none is measured and never gated. A decision is a `###` heading outside a fenced block, so the template a standard shows does not count, and a heading carrying two decisions counts once. The JSON record carries what it read as `architecture.entryCap`, absent where the record states no cap, and the audit catalog counts a record past it as `recordOverCount`.

The length check compares the record against the ceiling it derives for itself, and only a record that states its own allowances has one. No standard sets a length rule for this document, so the numbers belong to whichever record declares them. The check reads a frame allowance and an allowance per decision out of the record's own prose and puts the ceiling at the frame plus the allowance times the decision count. The JSON record carries what it read as `architecture.allowances` and the reading as `architecture.lines` against `architecture.ceiling`.

A record stating no such rule is measured and reported and never gated, which is the ordinary shape of a project that wrote an architecture record and no convention about its length. Holding a pair of numbers in the toolkit and gating every project against them would fail a record on a ceiling that project never agreed to, and the framed line would credit the rule to a file that does not state it.

What the derivation costs where it does apply is that the ceiling rises when a decision is added and falls for nothing, so the check passes exactly when the file grew. It gates anyway, because a record that states a limit for itself and makes it computable from a count has turned it into a fact, which is what separates it from every judgment the audit reports. A rewrite of the declaring sentence past the clauses the check reads falls back to reporting rather than to a stale ceiling, so the failure shows up in the run's own output.

The coverage report classifies each decision as carrying a countable claim, a structural invariant, or neither, then reports each testable entry against whether it names a check that exists. A countable claim carries a figure a run could recompute, and an invariant quantifies over a named tree closely enough that a walk could falsify it. A check is a `scripts/**.sh` path the entry spells that is on disk, or a `canon` invocation matching a registered audit, so coverage reads the entry rather than the tree and a claim some check happens to cover without the entry saying so reads as unchecked.

Three limits are stated on every run rather than hidden. The countable signal reads digits alone, so a measured claim written in words reads as uncounted. Entries are counted by heading, and one heading holding several decisions counts once. Nothing is stored, so an entry rewritten tomorrow is classified afresh the next time the verb runs and no verdict goes stale.

The report gates nothing. Deciding whether a sentence states a claim is a judgment no parser settles, so the output names candidates for a reader. This answers a different question from the verification anchors `standards/architecture.md` describes, which record that one cited number was re-read. That mechanism says whether a marked figure held, and this one says how much of the record could be checked at all.

The third finding is a word count, measured in words rather than lines: one figure for the whole record and one per decision. `standards/architecture.md` asks a session to judge the file's weight by reading it rather than by counting it, and reads the word figure alongside that judgment when one is available. A paragraph written one source line to a paragraph passes the rendered-line measure other checks use while still reading heavy, which is the gap a word count closes without turning into a second cap.

The `## Risks / open questions` section is weighed the same way, reported apart from the whole-record figure since the standard singles it out for holding only what is still open. This finding gates nothing under any mode. The JSON record carries the whole-record figure as `architecture.words`, the section figure as `architecture.risksWords` where the record carries the heading, and the per-decision figure as `architecture.decisions[].words`.
