---
title: Publish reference
description: Scan an author runs against finished text, the cross-reference form each destination takes, and the response to an unreadable source
---

# Publish reference

## Scope

Governs the scan an author runs against finished text on its way out, the form a pull request or issue reference takes in every destination, and the response when a source the scan reaches for cannot be read. As an attribute standard it applies wherever no automated check covers the text, and carries no template.

Does not govern:

- Which characters are banned, and the formatting the text carries: `markdown.md`
- The voice and rhythm the text is written in: the `write-human` skill
- The phase-label rule and the table of surfaces each namespace may appear on: `versioning.md`
- Which gap a given surface has, and what it publishes through, which that surface names for itself

## When it runs

Wherever text leaves through a channel no automated check covers, the author is the only gate and runs this scan. Text sent to another service, text written to a path the checks exclude, and text inside a fenced block are the usual cases.

- The surface publishing the text knows which gap applies, so it names its own rather than reading one here
- Run the scan as an explicit step against the finished text, since the check has to happen after the text exists

### Scope by destination

Text published to a remote takes every check below. Text staying in the repository takes the character bans alone, since those hold wherever the text lands.

- Phase labels and board identifiers depend on the reader holding this checkout, so repository text skips both
- Session links depend on the reader holding the account, a narrower dependency stated under their own heading

## Banned characters

`${CLAUDE_SKILL_DIR}/../markdown-craft/references/markdown.md` holds the character bans. Read it at scan time rather than working the sets from memory, then scan the drafted text and rewrite each occurrence.

- `canon labels scan` fails on these characters in a title or body outside a code span or a link, for a pull request and a posted review alike
- Restructure the sentence rather than substituting the character, since a semicolon swapped for a period keeps the shape the ban exists to remove

## Phase labels

`${CLAUDE_SKILL_DIR}/../git-commit/references/versioning.md` holds the label rule and the table of surfaces. Read it at scan time rather than working the format from memory.

The reader inside the repository has the task board and the reader on a remote does not, so this check is scoped by destination.

## Board identifiers

A phase label is one way text names the board, and a path under a record root is the other. Both resolve for a reader holding this checkout and for nobody else, so this check is scoped by destination too.

- A code span whose whole content is a label is still the label and a hit. A longer token inside a span is a fixture name and stays.
- A path under a record root is gitignored and absent from every clone, so `.canon/feedback/` names a folder the remote's reader cannot open
- Tracked `canon/` and `.claude/` paths are no hit, since `canon/context/surfaces/governance.md` resolves everywhere
- Every path under `.canon/` is a hit whichever folder it names, since one ignore line covers the root whole

### Fixing a hit

Rewrite a hit to name what the reader can reach rather than deleting it. State a row's subject plainly in place of its label, and say in a sentence what a record folder holds in place of its path.

`canon labels scan` runs this check and the phase-label one over a pull request title and body, and over a posted review's text once submitted. Any other channel, a plain issue comment among them, is still the author's own scan.

## Session links

A link to one Claude Code session names the session that wrote the text rather than the change it describes. The harness tells the composing session to end its published text with one, so the author writes it deliberately and reads that compliance as correct. That is how it passes a scan the same author runs.

- The session resolves only for the account that started it, so a reader inside this checkout still cannot open it
- The scoping sits at the invocation site, because `canon labels scan` reads a pull request title and body and no other text
- Delete a hit rather than rewriting it, since a session has no reachable form and the body above it already stands in its place
- Removing it before a merge is no substitute for never writing it, since a squash can land it from an earlier snapshot, permanently on the trunk

## Cross-reference form

A number referring to a pull request or an issue takes the form its destination renders. Write it bare where the destination auto-links it and in backticks where it does not, so a reference moved between destinations is rewritten rather than copied.

- Pull request or issue body, a comment on either, a commit: `#123` <!-- canon-allow-reference: the bare spelling this section defines, which a qualified form would destroy -->
- The same destinations when the reference crosses repositories: `owner/repo#123` <!-- canon-allow-reference: the two spellings this section defines, which a qualified form would destroy -->
- A markdown file browsed from the repository tree: the number in backticks, since neither spelling links there
- Content installed into another repository: qualified against a different, resolvable repository, or no number

A commit message takes the bare form even though the log links nothing, since the remote is what the form is chosen for. Text quoted from another surface keeps the spelling it arrived with, since rewriting it reports the source as saying something it never said.

### Installed content

A skill body loads from a plugin cache and a docs page is read through `canon docs`, so the reader holds their own repository rather than the one a bare number belongs to.

- Write `owner/repo#123` and `owner/repo@abc1234` for a different, resolvable repository, which the reader can open without this one
- Qualifying against `erclx/canon` fixes nothing, since a reader holding the cache or the package still cannot open this repository's history
- A same-repository citation takes no number, so state the fact it stood in for, and carry a one-off incident's identifier into the `canon/context/` entry owning the surface
- `canon gate run` fails a push on a bare reference there, and a line whose bare form is the point carries `canon-allow-reference: <reason>` on itself or the line above

### Number or sha

Choose the number where the citation names a decided change, since it resolves to the diff and the review behind it. Take the sha only for a tree or measurement state, the `Measured at <sha>` shape a context entry already uses. The choice holds for the bare and the qualified spelling alike.

## An unreadable source

Stop and name the source when one this scan reaches for cannot be read. Do not scan what resolved and report the result.

A half-run scan that says nothing is worse than one that visibly did not happen, because the surfaces running this scan describe themselves as the only gate. Its clean result is read as coverage.
