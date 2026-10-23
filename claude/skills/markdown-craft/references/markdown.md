---
title: Markdown reference
description: Headings, density limits, paragraph and list shape, code spans, the date form, punctuation, emphasis, file references, American spelling, and frontmatter wording
---

# Markdown reference

Applies to markdown reference docs, READMEs, and inline documentation in repos. Every rule here is a fact a scan can settle rather than a judgment, so no surface yields any of them. A surface stating its own voice claims that yield from the voice guidance and formats and spells by this file regardless.

## Contents

- [Scope](#scope)
- [Headings](#headings)
- [Density](#density)
- [Code and identifiers](#code-and-identifiers)
- [Dates](#dates)
- [Punctuation](#punctuation)
- [Language](#language)
- [Frontmatter descriptions](#frontmatter-descriptions)
- [Emphasis and dividers](#emphasis-and-dividers)
- [Links and file references](#links-and-file-references)
- [Examples](#examples)

## Scope

Governs what a check can decide about a markdown file, being headings, density, paragraph and list shape, code spans and fences, the date form, punctuation, emphasis, file references, spelling, what prose may claim about its sources, and the wording of a catalog title and description.

It is an attribute standard rather than a document-type one, so it applies over documents whose shape another standard sets. It carries no template, since these rules run across every document and have no shape of their own.

- The two frontmatter fields it reaches are `title` and `description`, named here since a backticked token in a scope statement's first sentence is published as its jurisdiction
- The character bans ship as data that `canon markdown audit` and the installed audit hook both read, so every run measures a violation

Does not govern:

- Voice, rhythm, sentence construction, and word choice, which the `canon:write-human` skill carries and a markdown edit routes to
- What sections a document has, or what belongs in each, which the standard for that document type sets
- Which frontmatter fields a document carries, which is that standard's subject
- The text inside a fenced block, which follows the conventions of its own language rather than these
- Phase-label and semver discipline, which is `versioning.md`, and the outbound ban scan and issue-number backticks, which turn on where text is published and are `publish.md`

## Headings

- H1 for document title, H2 for main sections, H3 for subsections, and no H4
- Use sentence case for every heading. The audit reports a heading or a frontmatter `title` with a capitalized word after the first.
- Proper nouns and product names keep their casing, whatever the audit reports
- Shape a record as H2 per section and H3 per item a reader looks up by name. Use a table only for a fixed-shape set.

### Seams

Every depth number counts rendered lines, each source line wrapped at 80 columns. Source lines undercount a file authored one line per bullet, where fifteen paragraph-bullets render past sixty lines.

- Past roughly 40 rendered lines with no heading breaking them, add a subheading at the seam. Measure the longest such run, excluding fenced code. The number is a checkpoint, not a cap.
- A checkpoint another standard states counts the same unit, so a file measured one way never sits beside a run measured another
- Keep a whole document at or under 300 rendered lines, frontmatter and fences included, since a session pays for every line it loads. Split it at a seam rather than compressing it.
- The 300 lines are a ceiling. `canon markdown audit` lists each document past it without failing, and a gate stage reads the same number, so the project's gate decides whether a push fails.

The ceiling exempts a file named `CHANGELOG.md`, which a release tool rewrites. It also exempts a document carrying `<!-- canon-length-exempt: <reason> -->` on its own line outside a fence, and a marker naming no reason exempts nothing.

### Exempt blocks

Two kinds of block are exempt from the 40-line checkpoint, since a subheading dropped into either splits something that belongs together.

- A block whose lines are all list items at one level averaging under roughly 130 characters, since a flat list of short peers is already navigable
- Weight decides rather than count, since a catalog of one-liners and a stack of paragraphs reach one count and read nothing alike. The cap on a bullet run is a separate rule.
- Mixing prose into that list, or nesting levels in it, ends the exemption at any weight
- A block of table rows, since a heading splits the table rather than the run
- Prose either side of the table ends that exemption, since the block has a seam and a heading breaks it there

### Bold section markers

A bold section marker holding its line alone breaks a run the way a heading does. A template separating sections with `**Risks:**` rather than `## Risks` has written the seam a reader lands on.

- The marker starts at column zero and is the whole line. A bold phrase opening a sentence stays emphasis, and an indented one stays a label inside its list item.
- A colon-less marker breaks on either of two signals, since no one test separates every marker from a sentence set in bold
- A label that is one whole code span breaks at any width, so a bold line holding only a backticked path reads as the file heading it is
- Anything else breaks at 20 characters or fewer, which reaches `**Testing**` and leaves a bold sentence as prose

## Density

Six limits keep a file scannable on sight, each a fact `canon markdown audit` measures that fails the push where the surface's gate is on. A table takes four more in `tables.md`, two of them gating. Open an H3 with a lead sentence or a table, then a few bullets or a short paragraph, since monotone text is the defect.

| Rule                | Limit                                             |
| ------------------- | ------------------------------------------------- |
| Paragraph length    | 350 characters                                    |
| Paragraphs in a row | 2 at most                                         |
| Bullet length       | 200 characters                                    |
| Bullets in a row    | 5 plain bullets at most                           |
| Heading depth       | H3 at most, no H4                                 |
| H3 opening          | First block under an H3 is a paragraph or a table |

Rules, a requirements or design record, a changelog, examples, and `.canon/` records take no density finding, since each keeps its own shape. `CLAUDE.md` takes the run limit and the H3 opening inside `## Key paths` alone.

### How each limit counts

A paragraph is read straight through and a bullet is scanned, so the paragraph limit sits above the bullet one. Four sentences to a paragraph stays advice rather than a limit.

- A paragraph's length folds in the lines that wrap it. A paragraph inside a list item counts toward its bullet, never as a paragraph or toward a run.
- A bullet's length counts its continuation lines and excludes any bullet nested under it, and a nested bullet is measured on its own
- A heading, list, table, fence, or bold section marker ends a run of paragraphs
- A blank line, a continuation, and a nested item do not break a run of bullets, and a paragraph or a heading does
- A run whose every item opens with a bold label or a link is exempt from the run limit, since each item names its own subject. A task box is not a link, so a checklist counts as plain.

Numbered items do not count toward a bullet run. Fix a finding by its shape, splitting a paragraph at its next logical boundary and folding a long run into prose, an H3 per item, or a split at the seam. A rewrite may cut repetition and history, and never a stated reason.

### Content

A file can pass every limit and still say too much.

- State one fact per bullet, with its reason in the same sentence, as "X, so Y"
- State what holds now. History and rejected options go in a decision record.
- Do not write a sentence that restates its heading or the line above it
- Collapse a stack of bullets narrating one subsystem into one H3 with one narrative, since splitting a heavy bullet into light ones reads no better

### Bullet form

A bullet's punctuation follows its sentence count, and a list opens unannounced.

- Use dashes (`-`) not asterisks (`*`) for bulleted lists
- Do not end single-sentence or fragment bullets with a period. Use periods when a bullet has two or more sentences.
- For key path lists, use colon format: `- \`src/\`: description`. Never use an em dash.
- Do not introduce a list with a "Here are the X:" or "The following X:" lead-in

## Code and identifiers

- Wrap commands, API names, file paths, and code identifiers in backticks
- Use a language identifier on every fenced code block, such as `markdown`, `typescript`, or `plaintext`. Never use a bare ` ``` `.
- In ASCII tree diagrams, use `←` for inline annotations. Never use `#`.

## Dates

- Write a date as `YYYY-MM-DD` wherever one appears, in frontmatter, in prose, and in a filename. Never a month name, a slash-separated form, or a two-digit year.

## Punctuation

- Do not use em dashes (`—`) or semicolons (`;`). Rewrite or restructure the sentence to avoid them. A colon or a comma standing where the dash was is the same sentence, so split it or rewrite it.
- Do not use a colon to join two clauses in the middle of a sentence. A colon belongs after a label or at the end of a line introducing a list.
- Do not use parenthetical asides in prose (`the config (which is optional) controls...`). Split into its own sentence or drop it. Parentheses in rule definitions for grouping examples are fine.

## Language

Use American English spelling.

- Open a sentence with its subject and action, not filler (`Basically`), a hollow connective (`It's worth noting`), or a gerund windup (`Leveraging the API...`). A real transition is fine.
- Do not use the negative parallelism pattern (`It's not X, it's Y`, `not because X, but because Y`)
- Do not pad verb phrases or delay the action. Write the shortest form (`in order to` → `to`, `ensure that X is set` → `set X`, `By doing X, you can Y` → state Y directly).
- Do not address the reader as a participant (`Let's`, `Here's`, `Here are`). State the content directly.

A claim carries the weight its source gives it and no more.

- Commit to a position. Do not hedge in clusters (`It might be worth considering`) or use false balance (`While X is true, Y is also important`). Recommend, or state the tradeoff.
- Do not inflate significance. State what a thing does rather than calling it `a major milestone` or `a turning point for the field`.
- Do not name a person, company, or product to borrow its authority. Name a source only where the claim turns on who made it.
- Do not attribute a claim to an unnamed authority (`experts say`, `studies show`, `it is widely believed`). Name the source or cut the claim.
- Do not introduce a fact, name, date, or citation the source does not carry when rewriting existing text. A rewrite changes wording and never claims.

One command reads the character bans under `## Punctuation`. `canon markdown audit` ships them as package data, so a project that installed no standards is measured the same as one that did. This file states them for a reader rather than for the parser, and the spelling line ships no set, so a project's spell checker enforces it.

## Frontmatter descriptions

When frontmatter carries a `title` or `description` used for catalog display:

- `title`: sentence case, identifies the file uniquely against its siblings in the same catalog. Proper nouns retain their casing. No trailing period.
- `description`: sentence case, names the specific topics covered so a reader can decide whether to open the file. No trailing period, no leading article (`the`, `a`).
- Lead a `description` with concrete subjects, and strip filler like "guide to", "overview of", or "documentation about"
- Do not mechanically reuse the H1 as the description.

## Emphasis and dividers

- Do not over-format with excessive bold, italic, or header usage
- Do not use horizontal rules or dividers (`---`) in body content. The `---` delimiters of a YAML frontmatter block at the top of the file are allowed.

## Links and file references

- Use descriptive anchor text for links. Avoid `click here` or `read more`.
- Wrap file references in backticks by default. Never repeat the path verbatim as a link label.
- Use a labeled markdown link (`[label](path)`) only on rendered-for-human surfaces (`README.md`, `docs/`) and in an index file, whose rows exist to be followed
- A relative link resolves against the filesystem over the corpus the ban scan reads, and one carrying a placeholder in angle brackets, such as `<slug>`, is an exempt illustration

## Examples

Each pair shows a banned pattern and its fix.

```markdown
Bad: See [canon/context/retrieval.md](canon/context/retrieval.md) for the retrieval flow.
Good: See `canon/context/retrieval.md` for the retrieval flow.

Bad: Read [docs/development.md](docs/development.md) before contributing.
Good: Read the [development guide](docs/development.md) before contributing.

Bad: In order to configure the server, you'll need to ensure that the port is set.
Good: Set `port` in the server config.

Bad: It's not just a cache. It's a system for intelligent memory management.
Good: The cache is an LRU store. It evicts the least-recently-used entry when full.

Bad: Leveraging the retry mechanism, developers can build more resilient integrations.
Good: Use the `retry` option for failed webhooks. Set `maxRetries` to 3.

Bad: It might be worth considering whether to enable caching.
Good: Enable caching for read-heavy endpoints. Skip it for writes.
```
