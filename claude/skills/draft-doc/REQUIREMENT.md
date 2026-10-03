---
name: draft-doc
description: Why a brand-new project document needs its kind's standard, a catalog collision check, and a confirm step, not the rewrite and refresh paths docs-sync and context-fold already own
---

# Doc draft requirement

## Gap

Without this skill, a session drafting a document that has no prior version either invents a shape from memory or reaches for a rewrite or refresh surface. `docs-sync` and `context-fold` read an existing document and a diff, and a document that never existed has neither, so they report the request as unrelated to any change. Either way the document ships with no read of the standard its kind answers to and no check against the catalog for a sibling already covering the same ground under a different name.

The same procedure ran as five skills, one per kind, each restating the read, the collision check, the confirm, and the write. They drifted on their own cadence, and five descriptions competed for one trigger, writing a new document.

## Must

- Resolve the kind from the destination the request names, and ask rather than defaulting when it names none, since a document in the wrong surface is invisible where a reader looks for it
- Load exactly one kind reference per run, so every step that differs by kind lives in one file and the shared procedure in one body
- Read the kind's standard before drafting, since its frontmatter contract and its reader questions make the document arguable against a sibling
- Check the catalog by exact name and by title and description, since a subject can be covered under a name the request does not guess
- Confirm the resolved path, the kind's detections, and the full content with the user before writing, since placement and detection are judgment calls with no diff to preview them against
- Regenerate the catalog of the folder the document landed in, where the kind keeps one, so the next run's collision check sees it
- Carry each kind's own musts in its reference: the root check for context and wireframes, tier detection and the two modes for wireframes, both placement tests and a fetched source for the wiki, and project detection and rendered-value badges for the readme

## Must not

- Rewrite, refresh, or sync a document that already exists. A collision refuses toward the surface that owns the existing document.
- Hand-edit an `index.md`. It regenerates from sibling frontmatter, and a hand edit is overwritten on the next regen.
- Substitute recall for a failed fetch on the wiki kind, or invent an image or a placeholder path on the readme kind.
- Build a companion render for a detected wireframe tier, or a hand-drawn diagram loop for a docs page.
- Widen the wiki's folder split to admit a subject its second placement test rejects. That is a change to the standard, argued there.
- Assume this skill's routing needs no check. One description now covers five triggers, and a ranking over descriptions is a proxy for how Claude Code routes, so a review some months in should read real invocations back.

## Guards

- No subject given, for any kind but the readme: stop and ask what the document should cover.
- No destination named: ask which kind rather than defaulting to `docs/`.
- Every other guard is the kind's own, stated in its reference.

## Out of scope

- Rewriting or syncing an existing `docs/` page or an authored README against a diff: `docs-sync`
- Refreshing an existing context entry or wireframe, or stubbing a surface a diff touched: `context-fold`
- Drafting a standard or a governance rule: `create-standard`, `create-rule`
- Drawing a figure or a diagram for a document: `draft-figure`
- Voice, rhythm, punctuation, and formatting in the drafted document: the `write-human` skill and the markdown standard
