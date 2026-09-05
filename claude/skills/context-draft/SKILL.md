---
name: context-draft
description: Drafts a brand-new `.claude/context/<domain>.md` entry against `standards/context.md`, checks the catalog for a name-or-topic collision, decides flat-file placement, confirms with the user, then writes. Use when asked to "write a context entry for X", "document the X domain", "add a context entry for X", or "create a .claude/context page for X" where no existing entry covers the domain. Do NOT use to refresh an existing entry against a diff, which is `claude-docs`.
---

# Context draft

Drafts one brand-new `.claude/context/<domain>.md` entry end to end: read the standard, decide whether the domain is already covered under a different name, confirm the draft with the user, then write.

Read these files in parallel:

- `${CLAUDE_SKILL_DIR}/../../standards/context.md`: the three questions an entry must answer, its frontmatter, required and expected sections, and what stays out of it
- `${CLAUDE_SKILL_DIR}/../../standards/markdown.md`: banned words, punctuation, and formatting for all generated text
- The `write-human` skill: voice, rhythm, and sentence construction for all generated text

## Guards

- If no domain is given, stop: `❌ No domain given. Name the domain this entry should cover.`
- Derive a kebab-case slug from the domain and check whether `.claude/context/<slug>.md` or `.claude/context/<slug>/index.md` already exists. Either resolving means the domain is already covered under that exact name. Stop: `❌ <slug> already has a context entry. Use claude-docs to refresh it instead.`

## Placement

- Read `.claude/context/index.md` and check every title and description it lists against the domain. The Guards check above only catches an exact-slug collision, and a domain already covered under a different name still resolves here at no extra cost, since this read already runs.
- Stop the same way on a match: `❌ <path> already covers this domain under a different name. Use claude-docs to refresh it instead.`
- Default a brand-new entry to a flat file, `.claude/context/<slug>.md`. A domain starts as one page's worth of narrative, and the standard only splits it into a folder once it holds three or more sub-areas, which a fresh domain never does on day one.

## Draft

- Read the domain's own folders and files well enough to answer the standard's three questions: where things live, why they are that way, and how to add one more of what the domain holds.
- Draft `title` and `description` frontmatter, then `## Overview`, `## Layout` (folder ownership lines only, never a file-by-file list), and `## Decisions` or `## Gotchas` wherever the domain's history supplies a non-obvious choice or a workaround worth preserving. Omit an expected section with nothing to put in it rather than padding it.
- Draft against `${CLAUDE_SKILL_DIR}/../../standards/context.md`'s template and ordering: `Overview`, `Layout`, `Decisions`, `Gotchas`, then anything else.

## Confirm

- Show the resolved path and the full drafted content before writing.
- Confirm both with the user. This skill waits for that answer rather than treating the tool permission dialog as the gate, since placement here is a judgment call with no diff to preview it against.

## Write

- Write the file at the confirmed path, creating the folder when it is absent.
- Run `canon markdown audit <path>`.
- Run `canon indexes regen .claude/context`, so the domain appears in `.claude/context/index.md` immediately rather than drifting until the next unrelated regen.

## Response format

### Preview

**Domain:** `<domain>`
**Placement:** `<path>`

```markdown
<drafted frontmatter and body>
```

### After confirmation

```plaintext
✅ Drafted: <path>
```
