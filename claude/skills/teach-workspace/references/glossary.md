---
title: Glossary reference
description: Frontmatter, entry shape, ordering, and the rules deciding which terms a glossary carries
---

# Glossary reference

Applies to a glossary, the file holding one entry per term a body of material defines. It changes whenever the material names a concept a reader cannot look up yet, and it is revised in place rather than appended to.

## Scope

Governs a glossary at `.canon/teach/<nn>-<topic>/GLOSSARY.md` and at whatever path a surface fixes for one it holds: its frontmatter, entry shape, ordering, grouping, and the rules deciding which terms it carries.

Does not govern:

- The folder a learning workspace lays out around its glossary, and the other files in it: `teach.md`
- Which surface a glossary moves to once it leaves the material that produced it, which belongs to the surface driving that move
- Voice, rhythm, and sentence construction: the `write-human` skill
- Headings, punctuation, word choice, and file references: `markdown.md`

## What a working glossary looks like

A glossary works when a reader who meets a term in the material settles it here without opening the page that introduced it:

- Which word does this material use for the concept, and which words does it deliberately not use?
- What does the term mean, stated without leaning on the term itself?
- Where does the term appear, so a reader can see it used rather than only defined?
- Does every entry carry a term the material actually uses?

A glossary failing these is non-conforming even when it satisfies every shape rule below.

## Frontmatter

- `title` (required): names the material the terms come from, in sentence case
- `description` (required): one line naming what a reader gets from the entries

## Entries

- Write one entry per term, as a single bullet.
- Lead the bullet with the term as a bolded span, then the definition in one or two sentences.
- Define the term without using it. A definition that spends the term explains nothing to the reader who arrived not knowing it.
- Name where the term first appears, so a reader can reach one use of it in context.
- Keep an entry to the meaning. Worked detail belongs on the page that teaches the term.
- Sort entries alphabetically, so a reader who knows only the word finds it without reading the file.

## Which terms it carries

- Add a term once the material has used it, never ahead of that. A glossary front-loaded with terms nothing has introduced is a syllabus rather than a reference.
- Pick one word per concept and use that word everywhere. A glossary carrying two words for one thing hands the reader a choice it exists to remove.
- List each rejected synonym as an alias to avoid inside the entry that won, so a reader arriving with the wrong word lands on the right one.
- Use the glossary's own terms inside other definitions. A definition reaching for a synonym of a term defined two entries down teaches the reader a word the material does not use.
- Revise an entry the material has moved under rather than adding a second one narrating the change.

## Grouping

- Keep a short glossary as one alphabetical list under the title. Grouping a handful of entries costs a heading per category and saves no lookup.
- Group a glossary long enough that one list stops helping under `##` headings by category, sorted alphabetically within each. Roughly two screens of entries is the signal.
- Name each category so a reader picks it from the term alone. A category a reader cannot predict makes the grouping a second thing to search.
- State a departure from any rule above in the file itself, naming what it departs from and why. A glossary serving no single body of material is the case that produces one, since a term drawn from everywhere has no first appearance to name.

## Rendered grouping

Applies to a rendered glossary page, never to the source file above, which stays the flat alphabetical list the `## Grouping` rules above govern.

- Group a rendered glossary by the lesson its own "First seen in" citation names, ordered by lesson order, under a sub-heading naming the lesson's title rather than its filename.
- Trail with an "Other terms" group holding any entry the citation cannot attribute to a lesson, whether it names a reference page instead or carries no citation at all. Keep it in the alphabetical order the source file already carries.
- Keep the workspace-wide term filter matching against every group, and drop a group's own heading once filtering leaves nothing under it.

## Template

```markdown
---
title: <Material the terms come from>
description: <one line naming what a reader gets from these entries>
---

# <Material the terms come from>

<One line on which material these terms come from and when the file changes.>

- **<Term>**: <the meaning in one or two sentences, written without using the term>. Avoid <rejected synonym>. First appears in `<page or lesson>`.
- **<Term>**: <the meaning in one or two sentences, written without using the term>. First appears in `<page or lesson>`.
```
