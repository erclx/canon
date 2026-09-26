---
name: draft-docs
description: Why a brand-new docs/*.md page needs a placement decision and a confirm step, not the rewrite path docs-sync already owns
---

# Docs draft requirement

## Gap

Without this skill, a session drafting documentation for a surface that has no page yet either invents structure from memory or reaches for `docs-sync`, which has nothing to diff a nonexistent page against and reports the topic as unrelated to any change. Either way the page ships with no read of `standards/docs.md` and no catalog placement decided against the folder's actual shelves.

## Must

- Read `standards/docs.md` before drafting, since the frontmatter contract and the four reader questions are what make the page arguable against a sibling
- Decide placement from the existing catalog rather than guessing a folder, reusing a `category` value verbatim when one fits and defaulting to the `docs/` root when none does
- Confirm the resolved path and the full content with the user before writing, since placement is a judgment call with no diff to preview it against
- Run `canon indexes regen` on the containing folder after writing, so the folder's `index.md` picks up the new page immediately rather than drifting until the next unrelated regen

## Must not

- Rewrite an existing page. A topic already covered by a page refuses toward `docs-sync`.
- Hand-edit an `index.md`. It regenerates from sibling frontmatter, and a hand edit is overwritten on the next regen.
- Build a hand-drawn diagram-and-capture authoring loop. `standards/docs.md`'s Mermaid-fence permission is the only path to a diagram this skill takes.

## Guards

- No topic given: stop and ask what surface the page should cover.
- The derived slug already resolves through `canon docs <slug>`: stop and point at `docs-sync` instead. This catches an exact-name collision only.
- A page in the catalog already covers the topic under a different name: stop the same way, checked against the titles and descriptions Placement already reads.

## Out of scope

- Rewriting or syncing an existing `docs/*.md` section against a diff since main: `docs-sync`
- The `.claude/` planning surface: `context-fold`
- Drafting a standard, a snippet, or a governance rule: `create-standard`, `create-snippet`, `create-rule`
