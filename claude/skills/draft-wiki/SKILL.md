---
name: draft-wiki
description: Drafts a brand-new wiki reference page for a subject owned outside this repository, against the wiki standard. Checks the two placement tests and the catalog for a collision, sources the subject from its owner rather than from training knowledge, confirms with the user, then writes. Use when asked to "write a wiki page for X", "add a wiki reference for X", "document X in the wiki", or "create a reference page for X" where no page covers the subject yet. Do NOT use to edit or refresh a page that already exists, which is a plain edit against the same standard. Do NOT use for a subject this repository owns, which is `draft-docs` or `draft-context`.
---

# Wiki draft

Drafts one brand-new wiki reference page end to end: read the standard, settle placement, check the catalog for a collision, source the subject from its owner, confirm the draft with the user, then write.

Read these files in parallel:

- `${CLAUDE_SKILL_DIR}/../../standards/wiki.md`: the two placement tests, the frontmatter contract, the naming convention, the sourcing rule, and the page template
- `${CLAUDE_SKILL_DIR}/../../standards/markdown.md`: punctuation and formatting for all generated text
- The `write-human` skill: voice, rhythm, and sentence construction for all generated text

The standard's `## Placement` section names the folder a page lands in and the vendor subfolder under it. Resolve both from the project root and call them `<wiki-root>` and `<vendor>` below, so the body states the rule once and the standard stays the one owner of the path.

## Guards

- If no subject is given, stop: `❌ No subject given. Name the subject this page should cover.`
- If `<wiki-root>` does not resolve, say so and ask whether to create it before drafting. A project carrying no such folder has never taken the standard's placement rule, so creating it is a decision rather than a step.

## Placement

The standard sets two tests and a page has to pass both. Run them before drafting anything, since a page failing either is non-conforming however well it is written.

- **Owned outside this repository.** A subject describing how this repository works fails. Refuse and route it: `❌ <subject> is owned by this project, so it belongs in the docs surface, a context entry, or a skill body. Use draft-docs or draft-context.`
- **Owned by the vendor the folder split covers.** The standard names one owner and one subfolder. A third-party tool or a vendor-neutral concept fails, however reference-like it reads. Refuse and route it: `❌ <subject> is outside the wiki's folder split. Route it to the docs surface or a skill body rather than adding a second folder for it.`

Do not widen the split to admit a subject. Adding a sibling folder is a change to the standard, argued there, rather than a placement this skill takes on its own.

## Collision

- Derive the page slug per the standard's `## Naming` section and check whether `<wiki-root>/<vendor>/<slug>.md` already exists. If it does, stop: `❌ <path> already covers this subject. Edit that page against the standard instead of drafting a second one.`
- Read `<wiki-root>/<vendor>/index.md` and check every title and description it lists against the subject. The slug check above only catches an exact filename collision, and a subject already covered under a different name still resolves here at no extra cost, since this read already runs.
- Stop the same way on a match: `❌ <path> already covers this subject under a different name. Edit that page instead.`

## Source

The standard forbids working from training knowledge, so the draft is built on a read rather than on recall.

- Fetch current information through the `claude-code-guide` agent for any subject that agent covers. Its answer is the source the page is written from.
- Reach a subject the agent does not cover through the owner's own published documentation.
- Say the fetch failed and stop rather than substituting recall. A page sourced from memory is the failure the rule exists to prevent, and it ships looking identical to one that was checked.
- Close the intro with the `Source:` sentence the standard requires, linking the canonical page where one exists and naming the owner alone where the subject has no single URL.
- Stamp the read date on a source revised without notice, as `read <date>`. A claim traced to an undated read cannot be checked against what was actually read.

## Draft

- Draft `title` and `description` frontmatter against the standard's contract, then the intro paragraph closing on `Source:`, then the reference sections.
- Draft against the standard's template and keep its ordering.
- Write what the fetch returned rather than what the subject is assumed to do.
- Answer one question per section and stop. A reader arrives to settle something specific rather than to read the page through.
- Mark a claim the fetch left unsettled rather than smoothing over it. An unmarked gap reads as a checked fact.

## Confirm

- Show the resolved path, the source the page was built from, and the full drafted content before writing.
- Confirm all three with the user. This skill waits for that answer rather than treating the tool permission dialog as the gate, since the standard states outright that a wiki file is not written unasked.

## Write

- Write the file at the confirmed path.
- Run `canon markdown audit <path>`.
- Run `canon indexes regen <wiki-root>/<vendor>`, naming the folder the page landed in rather than the root above it. The verb rewrites the `index.md` sitting in the folder it is given and does not walk down, so regenerating at the root leaves the vendor catalog untouched and the new page missing from the one the Collision step reads. A page absent there is invisible to the next run, which then drafts a second page on the same subject.

## Response format

### Preview

**Subject:** `<subject>`
**Placement:** `<path>`
**Source:** `<owner, and the read it came from>`

```markdown
<drafted frontmatter and body>
```

### After confirmation

```plaintext
✅ Drafted: <path>
```
