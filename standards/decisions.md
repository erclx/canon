---
title: Decisions reference
description: Folder layout, ordinal filename, frontmatter, record sections, and the append-only lifecycle for canon/decisions/
---

# Decisions reference

Applies to `canon/decisions/`. Holds the history a canonical doc used to carry itself: pick rounds, superseded figures, and a decision's rejected alternatives, in a tracked folder nothing loads eagerly. A canonical doc points at a record from its own history section rather than restating it.

## Scope

Governs `canon/decisions/`: folder layout, the ordinal filename, frontmatter, record sections, and the append-only lifecycle.

Does not govern:

- Which canonical doc points here and when, and what stays behind in that doc's own body: `architecture.md`, `context.md`, `wireframes.md`, `design.md`, `requirements.md`, once each states its own retirement rule
- Voice, rhythm, and sentence construction: the `write-human` skill
- Headings, punctuation, word choice, and file references: `markdown.md`

## What a working record looks like

A record works when a reader who has never opened the project can follow it from the file alone:

- What was decided, stated once, without needing the canonical doc that points here
- What else was considered, and why each alternative lost
- Which claim rests on a measurement, and what commit that measurement was read against

A record failing these is non-conforming even when it satisfies every shape rule below.

## Folder name

- `canon/decisions/`, resolved the way every tracked surface is: at `canon/decisions/` in a project that has moved, at `.claude/decisions/` in one that has not.
- Never add `canon/decisions/index.md` to a `CLAUDE.md` `@` import. A log that loads eagerly rebuilds the bloat it exists to absorb. A canonical doc's own pointer is how a reader reaches a record, one file at a time.

## Record filename

- Name each record `<nn>-<slug>.md`, a two-digit zero-padded ordinal followed by a kebab-case slug, the same shape a groundwork track's folder takes.
- The ordinal is the order the record was written in, which is what lets a listing sort by when a decision landed rather than alphabetically by subject.
- Never renumber an existing record. A later reader cites it by that name, and a record whose number moved is a record a stale citation can no longer find.

## Frontmatter

- `title` (required): the decision in sentence case
- `description` (required): one line naming what was decided

## Sections

Use `## Context`, `## Decision`, `## Alternatives`, and `## Measurements`.

- `## Context`: the problem as it stood, stated so a reader needs nothing else open. Restate a fact rather than pointing at where it was found.
- `## Decision`: what was chosen, and why, in enough detail that a reader can tell it apart from an alternative that sounds similar.
- `## Alternatives`: each one considered and dropped, with the reason it lost. An alternative with no stated reason reads as a claim nobody checked.
- `## Measurements`: skip when the decision cites no number. When it does, state the number and close with the commit it was read against, per Verification anchors below.

## Verification anchors

A record's reasoning stays correct while the numbers it cites move. The anchor records what a measured claim was read against, so a reader can tell a number that was checked and held from one nobody has looked at since.

- Close a `## Measurements` section with a trailing sentence naming the short commit SHA and the ISO date that number was read: `Measured at <short-sha> on <YYYY-MM-DD>.`
- Anchor on the number alone. A record citing none carries no `## Measurements` section at all.
- Read an absent section as unchecked rather than as current. A record with no measurements has nothing due a re-read.

## Lifecycle

- Append-only. A written record is never edited to reflect a later reversal.
- Write a new record when a later decision supersedes an earlier one, naming the record it supersedes. The old record stays as it was written, since it is history rather than a live statement of the current shape.
- Never auto-loaded. A canonical doc's own history section links to a record by relative path, and a reader reaches it by following that link, not by the folder loading with the session.

## Citation

- Never cite `.canon/`. A record restates what it needs, since a clone without the gitignored records folder resolves nothing there.
- Cite a same-repository pull request or commit the way `publish.md` fixes for any tracked document.

## Template

```markdown
---
title: <Decision, in sentence case>
description: <one line naming what was decided>
---

# <Decision title>

## Context

<The problem as it stood, self-contained.>

## Decision

<What was chosen, and why.>

## Alternatives

- **<Alternative>.** <Why it lost.>
- **<Alternative>.** <Why it lost.>

## Measurements

<The number the decision rests on.> Measured at <short-sha> on <YYYY-MM-DD>.
```
