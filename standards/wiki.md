---
title: Wiki reference
description: Folder split, frontmatter, naming convention, and sourcing for a wiki reference page
---

# Wiki reference

Applies to each authored page under `wiki/`. Skip for `index.md` at any depth, which is a hand-maintained catalog rather than a reference page, and carries `subtitle` rather than `description`.

## Scope

Governs each authored page under `wiki/`: which folder it belongs in, its frontmatter, its filename, and how it cites the subject it documents.

Does not govern:

- Voice, rhythm, sentence construction, and information density: the `write-human` skill
- Headings, punctuation, word choice, and file references: `markdown.md`

## What a working wiki page looks like

A page works when a reader who has never opened it settles two things without asking anyone:

- Which folder holds it, decided from the subject alone rather than from where it happened to get written
- Where the content came from, so a claim can be checked against its owner rather than against this repository

A page failing either is non-conforming even when it satisfies every shape rule below.

## Placement

- Write a page here only when its subject is owned outside this repository. Route anything about how this repository works to `docs/`, `canon/context/`, or a skill body instead.
- File the page under `wiki/claude/`. A subject Anthropic does not own, whether a third-party tool or a vendor-neutral concept, is out of scope for this folder split. Route it to `docs/` or a skill body instead of adding a second wiki folder for it.

## Frontmatter

- `title` (required): sentence case, naming the subject
- `description` (required): one line naming what the page covers

## Naming

- Name a page by its kebab subject alone. The vendor folder it sits in already names the vendor, so a prefix repeats the folder.

## Sourcing

- Close the intro paragraph with a `Source:` sentence naming the owner. Link the canonical page where one exists, and name the owner alone where the subject has no single URL.
- Fetch current information through the `claude-code-guide` agent when the subject is Claude Code. Do not work from training knowledge.
- Propose an addition or correction and wait for confirmation. Do not write to a wiki file unasked.

## Template

```markdown
---
title: <Subject>
description: <one line naming what this page covers>
---

# <Subject>

<What the subject is and why it matters.> Source: <owner, with a link to the canonical page where one exists>.

## <Section>

<Reference content.>
```
