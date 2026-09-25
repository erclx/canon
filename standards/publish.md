---
title: Publish reference
description: Scan an author runs against finished text, the cross-reference form each destination takes, and the response to an unreadable source
---

# Publish reference

## Scope

Governs the scan an author runs against finished text on its way out, the form a pull request or issue reference takes in every destination, and the responses available when a source it reaches for cannot be read. It is an attribute standard rather than a document-type one, so it applies wherever no automated check covers the text, whether that text is leaving through a channel or sitting in the repository, and it carries no template because a scan has no document to shape.

Does not govern:

- Which characters are banned, and the formatting the text carries: `markdown.md`
- The voice and rhythm the text is written in: the `write-human` skill
- The phase-label rule and the table of surfaces each namespace may appear on: `versioning.md`
- Which gap a given surface has, and what it publishes through, which that surface names for itself

## When it runs

Wherever text leaves through a channel no automated check covers, the author is the only gate and runs this scan. Text sent to another service, written to a path the project's checks exclude, and text inside a fenced block are the usual cases. The surface that publishes the text is what knows which gap applies, so it names its own rather than reading one here.

Run the scan as an explicit step against the finished text. Having read the underlying rules before drafting does not cover it, because the check has to happen after the text exists.

Scope every check below by destination. Text published to a remote takes all of them. Text staying in the repository takes the character bans alone, since those hold wherever the text lands, and skips whichever check depends on the reader holding something only this checkout carries. The two checks below that depend on it say so under their own headings.

## Banned characters

`markdown.md` holds the character bans. Read it at scan time rather than working the sets from memory, then scan the drafted text and rewrite each occurrence.

Restructure the sentence rather than substituting the character. A semicolon swapped for a period leaves both clauses in the order the semicolon chose, which is the shape the ban exists to remove.

## Phase labels

`versioning.md` holds the label rule and the table of surfaces. Read it at scan time rather than working the format from memory.

This check is one of the two the destination rule above scopes. The reader inside the repository has the task board and the reader on a remote does not.

## Board identifiers

A phase label is one way text names the board, and a path under a record root is the other. Both resolve for a reader holding this checkout and neither resolves for anyone else, so this check is the second one the destination rule scopes.

Two shapes get past a reader scanning for a bare label. A code span quoting a label is still the label, so read a span whose whole content is one as a hit and leave a longer token inside a span alone, which is a fixture name rather than a reference. The second shape is a path under a record root, gitignored and therefore absent from every clone, so `.canon/feedback/` names a folder the remote's reader cannot open.

Under the tracked `canon/` and `.claude/` folders there is no hit, since `canon/context/governance/rules.md` resolves everywhere. `.canon/` carries no such carve-out: one ignore line covers the root whole, so every path beneath it is a hit regardless of which folder names it.

Rewrite a hit to name what the reader can reach rather than deleting it. A row's subject stated plainly replaces its label, and what a record folder holds, said in a sentence, replaces its path.

`canon labels scan` runs this check and the phase-label one over a pull request title and body, and over a posted review's own text once one is submitted. Any other channel, a plain issue comment among them, is still the author's own scan.

## Session links

A link to one Claude Code session names the session that wrote the text rather than the change the text describes. It enters because the harness tells the composing session to end its published text with one, so the author writes it deliberately and it reads as required rather than as a slip. That is what carries it past a scan the same author runs, and it is why a rule stating the ban does not reach the case: the session is following an instruction it was given, and reads its own compliance as correct.

This check depends on the reader holding the account rather than the checkout, which is narrower than the dependency the destination rule above scopes. A reader inside this checkout opens a record path and still cannot open a session, since the session resolves for the one account that started it and for nobody else. The scoping still sits at the invocation site, because `canon labels scan` reads a pull request title and body and reaches no other text.

Delete a hit rather than rewriting it. The other two checks replace a hit with what the reader can reach instead, and a session has no such form, so what stands in its place is the body already written above it.

Removing the link before a merge does not substitute for never writing it. One branch removed it, read the live body back clean, and the squashed commit landed carrying it anyway off an earlier snapshot, which is permanent on the trunk.

## Cross-reference form

A number referring to a pull request or an issue takes the form its destination renders. Write it bare where the destination auto-links it, and in backticks where it does not. Both spellings are correct, each in one place, so a reference moved from one destination to the other is rewritten rather than copied.

Text published to a remote is the auto-linking half: a pull request body, an issue body, a comment on either, and a commit message. Write `#123` there, and `owner/repo#123` where the reference crosses repositories, which the same auto-linking reaches. A markdown file browsed from the repository tree is the other half, where neither spelling links and the backticked one marks the number as an identifier. <!-- canon-allow-reference: the two spellings this section defines, which a qualified form would destroy -->

Content that installs into another repository is the third destination, and it splits on which repository the number names. A skill body loads from a plugin cache, a docs page is read through `canon docs`, and a standard through `canon standards`, so the reader holds their own repository rather than the one a bare number belongs to. Qualifying a number against a different, resolvable repository fixes that, since the reader can open that repository even without this one.

Qualifying it against `erclx/canon` fixes nothing, because a reader holding only the plugin cache or the published package still cannot open this repository's own history. A same-repository citation takes no number here at all, bare or qualified. State the fact the citation was standing in for instead, and where the identifier is the only trace of a one-off incident rather than a reproducible count, carry it into the `canon/context/` entry that owns the surface.

Write `owner/repo#123` and `owner/repo@abc1234` for a citation of a different, resolvable repository, across every such surface. `canon gate run` fails a push on a bare reference there, and a line whose bare form is the point carries `canon-allow-reference: <reason>` on itself or on the line above.

Choose the number over the sha where the citation names a decided change, since a pull request number resolves to the diff and the review behind it. Take the sha only for a tree or measurement state, the `Measured at <sha>` shape `canon/ARCHITECTURE.md` already uses. The choice holds for both spellings this section fixes, the bare form a remote auto-links and the qualified form a cross-repository citation carries.

A commit message takes the bare form even though it is also read through the log, where nothing links. The remote is what the form is chosen for, since a reader in the log loses only a link that plain text never carried.

Text quoted from another surface keeps the spelling it arrived with. A reference inside a quotation belongs to what is being quoted rather than to the text doing the quoting, so rewriting it reports the source as having said something it never said.

## An unreadable source

Stop and name the source when one this scan reaches for cannot be read. Do not scan what resolved and report the result.

A run that covers half its sources and says nothing is worse than one that visibly did not happen, because the surfaces running this scan are the ones that describe themselves as the only gate. A clean result from a half-run scan is read as coverage.
