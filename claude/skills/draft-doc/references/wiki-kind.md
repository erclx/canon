---
title: Wiki kind
description: The root guard, both placement tests, catalog collision, sourcing from the owner, and vendor-folder regen for a brand-new wiki reference page, read by draft-doc once the request resolves to the wiki kind
---

# Wiki kind

`draft-doc` reads this file when the request resolves to a wiki reference page. A page that already exists is edited against the same standard, never drafted a second time.

The standard's `## Placement` section names the folder a page lands in and the vendor subfolder under it. Resolve both from the project root and call them `<wiki-root>` and `<vendor>` below, so the standard stays the one owner of the path.

## Guards

- If `<wiki-root>` does not resolve, say so and ask whether to create it before drafting. A project carrying no such folder has never taken the standard's placement rule, so creating it is a decision rather than a step.

## Placement

The standard sets two tests and a page has to pass both. Run them before drafting anything, since a page failing either is non-conforming however well it is written.

- **Owned outside this repository.** A subject describing how this repository works fails. Refuse and offer the docs or context kind of this skill: `❌ <subject> is owned by this project, so it belongs in the docs surface or a context entry. Re-run draft-doc naming that destination.`
- **Owned by the vendor the folder split covers.** The standard names one owner and one subfolder. A third-party tool or a vendor-neutral concept fails, however reference-like it reads. Refuse: `❌ <subject> is outside the wiki's folder split. Route it to the docs surface or a skill body rather than adding a second folder for it.`

Do not widen the split to admit a subject. Adding a sibling folder is a change to the standard, argued there, rather than a placement this kind takes on its own.

## Collision

- Derive the page slug per the standard's `## Naming` section and check whether `<wiki-root>/<vendor>/<slug>.md` already exists. If it does, stop: `❌ <path> already covers this subject. Edit that page against the standard instead of drafting a second one.`
- Read `<wiki-root>/<vendor>/index.md` and check every title and description it lists against the subject. Stop on a match: `❌ <path> already covers this subject under a different name. Edit that page instead.`

## Source

The standard forbids working from training knowledge, so the draft is built on a read rather than on recall.

- Fetch current information through the `claude-code-guide` agent for any subject that agent covers. Its answer is the source the page is written from.
- Reach a subject the agent does not cover through the owner's own published documentation. Invoke `canon:search-craft` with the skill tool before searching for it, since finding the owner's documentation is the field-and-authority step that skill carries, and report it rather than proceeding silently when the skill does not resolve.
- Say the fetch failed and stop rather than substituting recall, even for a subject the session believes it knows. A page sourced from memory ships looking identical to one that was checked.
- Close the intro with the `Source:` sentence the standard requires, linking the canonical page where one exists and naming the owner alone where the subject has no single URL.
- Stamp the read date on a source revised without notice, as `read <date>`. A claim traced to an undated read cannot be checked against what was actually read.

## Draft

- Draft `title` and `description` frontmatter against the standard's contract, then the intro paragraph closing on `Source:` as a short orientation, then the lesson sections. Let the read of the source decide what is a lesson: keep a fact only when the source page does not state it, and leave reference detail to the source.
- Write what the fetch returned rather than what the subject is assumed to do.
- Answer one question per section and stop. A reader arrives to settle something specific rather than to read the page through.
- Mark a claim the fetch left unsettled rather than smoothing over it. An unmarked gap reads as a checked fact.

## Preview

Add `**Source:** <owner, and the read it came from>`, and confirm the source with the path, since the standard states outright that a wiki file is not written unasked.

## Write

Regenerate `<wiki-root>/<vendor>`, naming the folder the page landed in rather than the root above it. The verb rewrites the `index.md` in the folder it is given and does not walk down, so regenerating at the root leaves the vendor catalog untouched. A page absent there is invisible to the next run's Collision step, which then drafts a second page on the same subject.
