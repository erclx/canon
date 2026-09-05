---
name: wireframe-draft
description: Why a brand-new .claude/wireframes/<surface>.md file needs a real draft and a tier-detect step, not the stub the wireframe-sweep already writes
---

# Wireframe draft requirement

## Gap

Without this skill, a session drafting a wireframe for a surface with no file yet either invents an ASCII layout from memory with no read of `standards/wireframes.md`, or waits on the wireframe-sweep, which only fires against a diff and only ever writes a bare `TODO` stub rather than a real layout, copy, and behavior draft. Neither path checks whether a visual-design tier above ASCII is already in play for the project before drafting the tier-0 file.

## Must

- Read `standards/wireframes.md` before drafting, since the frontmatter contract, the layout and variant rules, and the Transcription-wireframes branch are what make the file arguable against a sibling
- Walk the whole `.claude/wireframes/` tree, including a grouped surface's own subfolder, before drafting, since a top-level-only check misses a nested match
- Detect an existing higher tier from `.claude/DESIGN.md` and the wireframes tree and report it, never build a companion render for it, since no shipped mechanism produces one
- Draft in transcription mode, citing the real source, when the surface names an already-built component. Draft in role-intent mode otherwise.
- Confirm the resolved path, the detected tier, and the full content with the user before writing, since the mode decision and the tier read are judgment calls with no diff to preview either against
- Run `canon indexes regen` on `.claude/wireframes/` after writing, so the catalog picks up the new surface immediately rather than drifting until the next unrelated regen

## Must not

- Build a tier-1 or tier-2 rendering mechanism, an Excalidraw round trip, or any companion render. Detecting and reporting a higher tier is the whole of this skill's reach past ASCII.
- Hand-edit `.claude/wireframes/index.md`. It regenerates from sibling frontmatter, and a hand edit is overwritten on the next regen.
- Assume this skill's own invocation frequency needs no check. Whether anything reaches for it beyond an author typing its name has no answer at creation time, so a review pass some months in should read that back rather than take the assumption on faith.

## Guards

- No surface given: stop and ask what surface the wireframe should cover.
- The derived slug already matches a file anywhere in the `.claude/wireframes/` tree, flat or nested: stop and point at editing that file directly, since no dedicated skill owns a full rewrite of an existing surface.

## Out of scope

- Stubbing a surface a diff touched, or reporting drift in an existing wireframe against a diff: `claude/skills/claude-docs/references/wireframe-sweep.md`
- Drafting a `.claude/context/<domain>.md` entry: `context-draft`
- Drafting a `docs/*.md` page: `docs-draft`
- Drafting a standard, a snippet, or a governance rule: `create-standard`, `create-snippet`, `create-rule`
- Building or wiring an actual tier-1 or tier-2 rendering pipeline: the visual design workflow's own tier guidance, out of reach of a hand-drafting skill
