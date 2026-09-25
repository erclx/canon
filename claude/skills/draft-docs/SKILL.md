---
name: draft-docs
description: Drafts a brand-new `docs/*.md` page against the docs standard, decides its placement in the existing catalog, confirms with the user, then writes. Use when asked to "add a docs page for X", "write a new doc for X", "document X under docs/", or "create a docs page for X" where no existing page covers the topic. Do NOT use to rewrite or sync an existing `docs/*.md` section against a diff, which is `docs-sync`.
---

# Docs draft

Drafts one brand-new `docs/*.md` page end to end: read the standard, decide where the page belongs in the existing catalog, confirm the draft with the user, then write.

Read these files in parallel:

- `${CLAUDE_SKILL_DIR}/../../standards/docs.md`: the reader a page serves, its frontmatter, structure, and what it links out to rather than restates
- `${CLAUDE_SKILL_DIR}/../../standards/markdown.md`: punctuation and formatting for all generated text
- The `write-human` skill: voice, rhythm, and sentence construction for all generated text

## Guards

- If no topic is given, stop: `❌ No topic given. Name the surface this page should cover.`
- Derive a kebab-case slug from the topic and run `canon docs <slug>`. A resolved page means the topic is already covered under that exact name. Stop: `❌ <slug> already resolves to an existing page. Run canon:docs-sync instead.` This is a name match rather than a topic match. Placement below checks the wider case.

## Placement

- Read `docs/index.md` and its sub-catalogs for the closest existing `category`. <!-- canon-allow-reference: illustrates the target project's own docs/ tree, not a citation of this repository's own corpus -->
- Check every page title and description this read surfaces against the topic. The Guards check above only catches an exact-slug collision, and a page already covering the same subject under a different slug still resolves here at no extra cost, since this read already runs. Stop the same way on a match: `❌ <path> already covers this topic under a different name. Run canon:docs-sync instead.`
- Reuse a matching `category` value verbatim. A near-miss spelling opens a second shelf holding one page, per the docs standard.
- Default to the `docs/` root with no `category` when nothing fits. A subfolder earns itself only once a shelf of pages already sits there, per the standard's splitting rule.

## Draft

- Draft `title`, `description`, and `category` (where one applies), then the page body, against `${CLAUDE_SKILL_DIR}/../../standards/docs.md`.
- Write for a reader with no source open. The standard's four questions are the test: what the surface is, what to run or write, what it refuses, and where to go for the adjacent surface.

## Confirm

- Show the resolved path and the full drafted content before writing.
- Confirm both with the user. This skill waits for that answer rather than treating the tool permission dialog as the gate, since placement here is a judgment call with no diff to preview it against.

## Write

- Write the file at the confirmed path, creating the folder when it is absent.
- Run `canon markdown audit <path>`.
- Run `canon indexes regen <folder>` on the containing folder, so its `index.md` picks up the new page.

## Response format

### Preview

**Topic:** `<topic>`
**Placement:** `<path>` (category: `<category-or-root>`)

```markdown
<drafted frontmatter and body>
```

### After confirmation

```plaintext
✅ Drafted: <path>
```
