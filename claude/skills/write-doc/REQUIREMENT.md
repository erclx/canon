---
name: write-doc
description: Why a brand-new project document needs its kind's standard, a catalog collision check, and a confirm step, not the rewrite and refresh paths docs-sync and context-fold already own
---

# Write doc requirement

## Gap

Without this skill, a session drafting a document with no prior version invents a shape from memory or reaches for a rewrite surface. `docs-sync` and `context-fold` read an existing document and a diff, so a new one reads as unrelated to any change.

The document then ships unread against its kind's standard and unchecked against the catalog for a sibling covering the same ground. Split into one skill per kind, the procedure drifts and the descriptions compete for one trigger.

## Must

- Resolve the kind from the destination the request names, and ask when it names none, since a document in the wrong surface is invisible where a reader looks for it
- Load exactly one kind reference per run, so every step that differs by kind lives in one file and the shared procedure in one body
- Read the kind's standard before drafting, and check the catalog by exact name and by title and description, since a subject can be covered under a name the request does not guess
- Confirm the resolved path, the kind's detections, and the full content with the user before writing, since placement and detection are judgment calls with no diff to preview them against
- Regenerate the catalog of the folder the document landed in, where the kind keeps one, so the next run's collision check sees it

## Must not

- Rewrite, refresh, or sync a document that already exists, since a collision refuses toward the surface that owns it
- Hand-edit an `index.md`, which regenerates from sibling frontmatter and overwrites the edit
- Substitute recall for a failed fetch on the wiki kind, or invent an image or a placeholder path on the readme kind
- Build a hand-drawn diagram loop for a docs page
- Widen the wiki's folder split to admit a subject its second placement test rejects

## Out of scope

- Rewriting or syncing an existing `docs/` page or an authored README against a diff, which `docs-sync` owns
- Refreshing an existing context entry, which `context-fold` owns
- Drafting a governance rule, which `create-rule` owns
- Drawing a figure or a diagram for a document, which `draw-figure` owns
- Voice, rhythm, and word choice in the drafted document, which `write-human` owns
