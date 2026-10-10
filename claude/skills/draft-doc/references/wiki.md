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
- The `codebase-layout` skill carries the same rule for every folder in a project, beyond the wiki.

## Sourcing

- Close the intro paragraph with a `Source:` sentence naming the owner. Link the canonical page where one exists, and name the owner alone where the subject has no single URL.
- Link a docs page in its fetchable form, `https://code.claude.com/docs/en/<page>.md`, so a session reads the live text rather than a copy.
- Fetch current information through the `claude-code-guide` agent when the subject is Claude Code. Do not work from training knowledge.
- Propose an addition or correction and wait for confirmation. Do not write to a wiki file unasked.

## Shape

- Keep a page thin: the `Source:` sentence, an orientation paragraph, and lesson sections. The source owns the reference detail and a paraphrase of it falls behind within days.
- Apply the lesson test per section: keep a fact about the subject only when the source page does not state it. Such a fact is a gotcha this project hit, a constraint it relies on, or how it uses the feature.
- Read the current source before keeping or cutting a section. A fact kept from memory is the drift this shape exists to prevent.
- Send a session that wants reference detail to the source and fetch it live. The page answers orientation and lessons only.
- Leave a page with no lessons as the source link and the orientation paragraph. A catalog routes a reader by page, so the stub stays.

## Template

```markdown
---
title: <Subject>
description: <one line naming what this page covers>
---

# <Subject>

<What the subject is and why it matters, in a short orientation.> Source: <owner, with a link to the canonical page where one exists>.

## <Lesson>

<A fact the source page does not state.>
```
