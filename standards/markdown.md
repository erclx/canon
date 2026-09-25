---
title: Markdown reference
description: Headings, paragraph and list structure, code spans, the date form, punctuation, emphasis, file references, American spelling, and frontmatter wording
---

# Markdown reference

Applies to markdown reference docs, READMEs, and inline documentation in repos. Every rule here is a fact a scan can settle rather than a judgment, so no surface yields any of them. A surface stating its own voice claims that yield from the voice guidance and formats and spells by this file regardless.

## Scope

Governs what a check can decide about a markdown file: headings, paragraph and list structure, code spans and fences, the form a date takes, punctuation, emphasis, file references, the spelling convention, what prose may claim about its sources, and the wording of a catalog title and description. It is an attribute standard rather than a document-type one, so it applies over documents whose shape another standard sets, and it carries no template because these rules are written across every document and have no shape of their own.

The two frontmatter fields it reaches are `title` and `description`. They are named here rather than in the statement above, since a backticked token in a scope statement's first sentence is published as the standard's jurisdiction.

The split with the voice guidance is what reads the rule rather than what the rule covers. The character bans ship as data `canon markdown audit` and the installed audit hook both read, so a violation is measured on every run. Word choice, cadence, rhythm, and information density are judgments a reader settles, and those travel in the `canon:write-human` skill, which a markdown edit routes to.

Does not govern:

- Voice, rhythm, sentence construction, and information density, which the `write-human` skill carries
- What sections a document has, or what belongs in each: the standard for that document type
- Which frontmatter fields a document carries, which is that standard's own subject. This file governs the wording of a `title` and a `description` and nothing else about them.
- The text inside a fenced block, which follows the conventions of its own language rather than these
- Phase-label and semver discipline: `versioning.md`
- The scan that applies these bans to finished text on its way out: `publish.md`
- Whether a pull request or issue number is backticked, which turns on where the text is published rather than on the text: `publish.md`

## Headings

- H1 for document title, H2 for main sections, H3 for subsections
- Use sentence case for all headings (H1, H2, H3)
- Proper nouns and product names retain their casing in headings
- Past roughly 40 rendered lines with no heading of any level breaking them, add a subheading at the seam. Measure the longest such run rather than everything under one `##`, and exclude fenced code blocks. The number is a checkpoint, not a cap.
- Count rendered lines rather than source lines, wrapping each source line at 80 columns and summing the heights. Source lines undercount a file authored one line per bullet, where a block of fifteen paragraph-bullets occupies fifteen lines and renders past sixty. A checkpoint another standard states counts the same unit, so a file measured one way never sits beside a run measured another.
- Keep a whole document at or under 300 rendered lines, counted over the full source with frontmatter and fenced blocks included, since a session pays for every line it loads. This one is a ceiling rather than a checkpoint. `canon markdown audit` lists every document past it without failing the run, and a gate stage reads the same number, so whether a push fails on it is the project's gate to decide. Split the document at a seam rather than compressing it.
- Exempt a file named `CHANGELOG.md`, which a release tool rewrites, and a document carrying `<!-- canon-length-exempt: <reason> -->` on a line of its own outside a fenced block. A marker naming no reason exempts nothing.
- Exempt a block whose lines are all list items at one level averaging under roughly 130 characters. A flat list of short peers is already navigable, and a subheading dropped into it splits a set that belongs together. Bullet count says nothing on its own, since a catalog of one-liners and a stack of paragraphs reach the same count and read nothing alike, so weight is what decides.
- Mixing prose with that list, or nesting levels inside it, ends the exemption at any weight.
- Exempt a block whose lines are all table rows, at any length. The peer list above is exempt because it is already navigable, and a table because the remedy does not exist: a subheading dropped inside one splits the table rather than the run, so no edit short of rewriting it as a list clears the checkpoint.
- Prose either side of the table ends that exemption, since the block has a seam and a heading breaks it there.
- Break a run on a bold section marker holding its line alone, the way a heading breaks one. A document whose template separates sections with `**Risks:**` rather than `## Risks` has written the seam a reader lands on, and reading only the heading reported every such file at its full length whatever it carried.
- Require the marker to start at column zero and to be the whole line. `**Risks:**` breaks a run, a bold phrase opening a sentence stays emphasis, and an indented one stays a label inside its list item.
- Break a colon-less marker on either of two signals, since no one test separates every marker from a sentence set in bold. A label that is one whole code span breaks at any width, which is how a bold line holding only a backticked path reads as the file heading it is. Anything else breaks at 20 characters or fewer, which reaches `**Testing**` and leaves a bold sentence as prose.

## Paragraphs and lists

- Use prose by default. Reserve bullets for discrete, unrelated items.
- Keep paragraphs to four sentences or fewer. Split longer blocks at the next logical boundary.
- Past roughly 700 characters in one paragraph, folding in the lines that wrap it, split at the next logical boundary as well. A paragraph written as two long sentences satisfies the sentence cap above and still asks the reader to hold too much at once. This number sits well above the bullet checkpoint because a paragraph is read straight through and a bullet is scanned.
- Keep bullets tight. Past roughly 400 characters in one top-level bullet, counting the lines that continue it and excluding any bullet nested under it, the overflow belongs in prose. The number is a checkpoint rather than a cap, and a bullet reading well past it means the number is wrong rather than the rule.
- Collapse a stack of bullets narrating one subsystem into a single `###` subsection carrying one narrative. Splitting a heavy bullet into three light ones satisfies the checkpoint above and leaves the reader no better off, and subdividing a block does not lighten the bullets inside it, so the two rules answer different defects.
- Use dashes (`-`) not asterisks (`*`) for bulleted lists
- Do not end single-sentence or fragment bullets with a period. Use periods when a bullet has two or more sentences.
- For key path lists, use colon format: `- \`src/\`: description`. Never use an em dash.
- Do not introduce a list with a "Here are the X:" or "The following X:" lead-in

## Code and identifiers

- Wrap commands, API names, file paths, and code identifiers in backticks
- Use a language identifier on all fenced code blocks (`markdown`, `typescript`, `plaintext`). Never use a bare ` ``` `
- In ASCII tree diagrams, use `←` for inline annotations. Never use `#`.

## Dates

- Write a date as `YYYY-MM-DD` wherever one appears, in frontmatter, in prose, and in a filename. Never a month name, a slash-separated form, or a two-digit year.

## Punctuation

- Do not use em dashes (`—`) or semicolons (`;`). Rewrite or restructure the sentence to avoid them.
- Do not use parenthetical asides in prose (`the config (which is optional) controls...`). Split into its own sentence or drop it. Parentheses in rule definitions for grouping examples are fine.

## Language

- Use American English spelling
- Open a sentence with its subject and action, not filler (`Note that`, `Basically`), a hollow connective (`That being said`, `It's worth noting`), or a gerund windup (`Leveraging the API...`). Substantive transitions that carry a real relationship are fine.
- Do not use the negative parallelism pattern (`It's not X, it's Y`, `not because X, but because Y`)
- Do not pad verb phrases or delay the action. Write the shortest form (`in order to` → `to`, `ensure that X is set` → `set X`, `By doing X, you can Y` → state Y directly).
- Do not address the reader as a participant (`Let's`, `Here's`, `Here are`). State the content directly.
- Commit to a position. Do not hedge in clusters (`It might be worth considering`) or use false balance (`While X is true, Y is also important`). Recommend, or state the tradeoff.
- Do not inflate significance. State what a thing does rather than calling it `a major milestone` or `a turning point for the field`.
- Do not name a person, company, or product to borrow its authority. Name a source only where the claim turns on who made it.
- Do not attribute a claim to an unnamed authority (`experts say`, `studies show`, `it is widely believed`). Name the source or cut the claim.
- Do not introduce a fact, name, date, or citation the source does not carry when rewriting existing text. A rewrite changes wording and never claims.

One command reads the character bans under `## Punctuation`. `canon markdown audit` ships them as package data, so a project that installed no standards is measured the same as one that did, and this file states them for a reader rather than for the parser. The spelling line above states a convention and ships no set, so a project's spell checker is what enforces it.

## Frontmatter descriptions

When frontmatter carries a short `title` or `description` used for catalog display:

- `title`: sentence case, identifies the file uniquely against its siblings in the same catalog. Proper nouns retain their casing. No trailing period.
- `description`: sentence case, names the specific topics covered so a reader can decide whether to open the file. Lead with concrete subjects, strip filler like "guide to", "overview of", or "documentation about". No trailing period, no leading article (`the`, `a`).
- Do not mechanically reuse the H1 as the description.

## Emphasis and dividers

- Do not over-format with excessive bold, italic, or header usage
- Do not use horizontal rules or dividers (`---`) in body content. The `---` delimiters of a YAML frontmatter block at the top of the file are allowed.

## Links and file references

- Use descriptive anchor text for links. Avoid `click here` or `read more`.
- Wrap file references in backticks by default. Use a labeled markdown link (`[label](path)`) only on rendered-for-human surfaces (`README.md`, `docs/`) and in an index file, whose rows exist to be followed. Never repeat the path verbatim as the label.
- A relative link's destination resolves against the filesystem, over the same corpus the ban scan reads. A destination carrying a template placeholder in angle brackets, such as `<slug>` or `<name>`, reads as an illustration rather than a literal path and is exempt.

## Examples

Each pair shows a banned pattern and its fix.

```markdown
Bad: See [canon/context/retrieval.md](canon/context/retrieval.md) for the retrieval flow.
Good: See `canon/context/retrieval.md` for the retrieval flow.
```

```markdown
Bad: Read [docs/development.md](docs/development.md) before contributing.
Good: Read the [development guide](docs/development.md) before contributing.
```

```markdown
Bad: In order to configure the server, you'll need to ensure that the port is set.
Good: Set `port` in the server config.
```

```markdown
Bad: It's not just a cache. It's a system for intelligent memory management.
Good: The cache is an LRU store. It evicts the least-recently-used entry when full.
```

```markdown
Bad: Leveraging the retry mechanism, developers can build more resilient integrations.
Good: Use the `retry` option for failed webhooks. Set `maxRetries` to 3.
```

```markdown
Bad: It might be worth considering whether to enable caching.
Good: Enable caching for read-heavy endpoints. Skip it for writes.
```
