---
name: draft-wiki
description: Why a brand-new wiki reference page needs both placement tests, a catalog collision check, and a sourced read before anything is written
---

# Wiki draft requirement

## Gap

Without this skill, a session asked for a wiki page writes one from training knowledge, which is the single thing the wiki standard forbids outright, and nothing in the resulting file shows that it happened. It also files the page by where the request came from rather than by who owns the subject, so material about the project itself lands in the wiki and material about a third-party tool acquires a folder the standard never sanctioned.

The standard can state all of this and still be read by nothing, which is the condition this skill was written into in the toolkit. A page written under that condition conforms by the author's memory rather than by a read, and it ships looking identical to one that was checked.

## Must

- Read the wiki standard before drafting, since the placement tests and the sourcing rule are the two things a session gets wrong from memory
- Run both placement tests and refuse on either, since a page passing one and failing the other is still non-conforming
- Check the subject against the catalog by title and description, not by slug alone, since a subject can be covered under a name the slug does not guess
- Build the draft on a fetched read and stop when the fetch fails, since a page written from recall is indistinguishable from a checked one once it ships
- Confirm the path, the source, and the content with the user before writing, since the standard forbids writing a wiki file unasked
- Name the folder by resolving what the standard states rather than by carrying a path in the body, since the body ships to projects whose layout this repository does not set

## Must not

- Widen the folder split to admit a subject the second placement test rejects. That is a change to the standard, argued there.
- Edit or refresh a page that already exists. A collision refuses toward editing the existing page rather than drafting a second one.
- Substitute recall for a failed fetch, even for a subject the session believes it knows.

## Guards

- No subject given: stop and ask what subject the page should cover.
- The wiki root does not resolve: say so and ask before creating it, since a project holding no wiki has never taken the placement rule.
- The slug already resolves to a page: stop and point at editing that page.
- The catalog already covers the subject under a different name: stop the same way, checked against the titles and descriptions the Collision step already reads.

## Out of scope

- Editing or refreshing a wiki page that already exists: a plain edit against the same standard
- Drafting a `docs/*.md` page: `draft-docs`
- Drafting a `canon/context/<domain>.md` entry: `draft-context`
- Voice, rhythm, and sentence construction in the drafted page: the `write-human` skill
- Punctuation, headings, and word choice in the drafted page: the markdown standard
