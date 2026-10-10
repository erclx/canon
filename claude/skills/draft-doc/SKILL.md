---
name: draft-doc
description: Drafts one brand-new project document from scratch against the standard for its kind, picking the kind from where it lands, a `docs/` page, a `canon/context/` entry, a wiki reference page, or a README.md. Checks the catalog for a name or topic collision, places it, confirms with the user, then writes. Use when asked to "write a new docs page for X", "write a context entry for X", "write a wiki page for X", or "write a README" where none exists yet. Do NOT use to rewrite or sync an existing page or README against a diff, which is `docs-sync`, or to refresh a context entry, which is `context-fold`.
metadata:
  family: generate
---

# Doc draft

Drafts one brand-new project document end to end: resolve its kind, read the standard that kind answers to, check the catalog for a collision, place it, draft, confirm with the user, then write.

## Resolve the kind

Each kind has one standard and one reference. Load the reference for the resolved kind and no other, since every step below that differs by kind lives there.

| Kind    | Lands at                                                 | Standard                                         | Reference                                     |
| ------- | -------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------- |
| docs    | a page under `docs/`                                     | `${CLAUDE_SKILL_DIR}/../../standards/docs.md`    | `${CLAUDE_SKILL_DIR}/references/docs.md`      |
| context | an entry under `canon/context/`                          | `${CLAUDE_SKILL_DIR}/../../standards/context.md` | `${CLAUDE_SKILL_DIR}/references/context.md`   |
| wiki    | a reference page on a subject owned outside this project | `${CLAUDE_SKILL_DIR}/references/wiki.md`         | `${CLAUDE_SKILL_DIR}/references/wiki-kind.md` |
| readme  | a `README.md`, at the root or in a folder                | `${CLAUDE_SKILL_DIR}/../../standards/readme.md`  | `${CLAUDE_SKILL_DIR}/references/readme.md`    |

- Read the kind off the destination the request names: a path, a folder, or the document's own name, such as "a context entry" or "a wiki page".
- Ask which kind when the request names no destination, offering the candidates the subject fits with the likeliest first. Never default to `docs/` without saying so, since a subject documented in the wrong surface is invisible to the session that looks for it in the right one.
- If no subject is given for any kind but readme, stop: `❌ No subject given. Name what this document should cover.` A README covers the project or the folder it sits in, so its subject is the target path.

## Read

Read these in parallel, from the project root where a path is relative:

- The kind's standard from the table above: the reader the document serves, its frontmatter, its structure, and what it links out to rather than restates
- `${CLAUDE_SKILL_DIR}/../markdown-craft/references/markdown.md`: punctuation and formatting for all generated text
- The `write-human` skill: voice, rhythm, and sentence construction for all generated text
- The kind's reference from the table above

## Guards

Run the guards the reference states before placing or drafting anything. Each one stops toward the surface that owns the case, and a stop writes nothing.

## Placement

Settle the path and check the catalog for a collision the way the reference states. An exact-name check alone misses a document already covering the subject under another name, so check the titles and descriptions of the catalog the placement step already reads, and stop the same way on a match.

## Draft

- Draft against the kind's standard, keeping its template and its section order.
- Draft frontmatter where the standard requires it, then the body, following the reference for what the kind adds.
- Write for a reader with no source open. Omit an expected section with nothing to put in it rather than padding it.

## Confirm

- Show the kind, the resolved path, whatever else the reference names for the preview, and the full drafted content before writing.
- Confirm with the user. Wait for that answer rather than treating the tool permission dialog as the gate, since the kind, the placement, and every detection the reference runs are judgment calls with no diff to preview them against.

## Write

- Write the file at the confirmed path, creating the folder when it is absent unless the reference narrows that.
- Run `canon markdown audit <path>`.
- Run `canon indexes regen <folder>` on the folder the reference names, so its `index.md` picks up the new document. Skip it where the reference says the kind keeps no catalog.

## Response format

### Preview

**Kind:** `<docs | context | wiki | readme>`
**Subject:** `<subject, or the target path for a README>`
**Placement:** `<path>`
<one line per preview field the reference names>

```markdown
<drafted frontmatter and body>
```

### After confirmation

```plaintext
✅ Drafted: <path>
```
