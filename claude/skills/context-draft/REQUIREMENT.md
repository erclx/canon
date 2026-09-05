---
name: context-draft
description: Why a brand-new .claude/context/<domain>.md entry needs a catalog collision check and a confirm step, not the refresh path claude-docs already owns
---

# Context draft requirement

## Gap

Without this skill, a session documenting a domain that has no context entry yet either invents a shape from memory or reaches for the refresh mechanism, which reads an existing entry and a diff and has neither to work from for a domain that never had one. Either way the entry ships with no read of `standards/context.md` and no check against the catalog for a sibling already covering the same ground under a different name.

## Must

- Read `standards/context.md` before drafting, since the frontmatter contract and the three-question test are what make the entry arguable against a sibling
- Check the domain against the existing catalog by slug and by title-and-description, not by slug alone, since a domain can be covered under a name the topic phrase does not guess
- Default a brand-new entry to a flat file, since a fresh domain never holds the three or more sub-areas the standard requires before it earns a folder
- Confirm the resolved path and the full content with the user before writing, since placement is a judgment call with no diff to preview it against
- Run `canon indexes regen` on `.claude/context/` after writing, so the catalog picks up the new domain immediately rather than drifting until the next unrelated regen

## Must not

- Refresh or rewrite an existing entry. A domain already covered refuses toward the refresh mechanism.
- Hand-edit `.claude/context/index.md`. It regenerates from sibling frontmatter, and a hand edit is overwritten on the next regen.
- Assume this skill's own invocation frequency needs no check. Whether anything reaches for it beyond an author typing its name has no answer at creation time, so a review pass some months in should read that back rather than take the assumption on faith.

## Guards

- No domain given: stop and ask what domain the entry should cover.
- The derived slug already resolves to `.claude/context/<slug>.md` or `.claude/context/<slug>/index.md`: stop and point at the refresh mechanism instead.
- The catalog already covers the domain under a different name: stop the same way, checked against the titles and descriptions the Placement step already reads.

## Out of scope

- Refreshing an existing `.claude/context/<domain>.md` entry against a diff: `claude-docs`
- Drafting a `.claude/wireframes/<surface>.md` file: `wireframe-draft`
- Drafting a `docs/*.md` page: `docs-draft`
- Drafting a standard, a snippet, or a governance rule: `create-standard`, `create-snippet`, `create-rule`
