---
name: draft-readme
description: Why a README needs a project-type read and a confirm step, not the rewrite path docs-sync already owns
---

# Readme draft requirement

## Gap

Without this skill, a session drafting a README either copies the generic template from memory or reaches for `docs-sync`, which has nothing to diff a nonexistent page against and reports the topic as unrelated to any change. A scaffold-written stub meets the same dead end, since no diff touches it either. Either way the page ships with no read of `standards/readme.md`, no read of what the project actually is, and no badge chosen against its rendered value rather than its service name.

A README whose real documentation lives in `canon/context/` or `docs/` was a second gap the standard itself carried until this build: nothing named a pointer page as complete, so a session drafting one either padded the page or read the required list as unsatisfied.

## Must

- Read `standards/readme.md` before drafting, since its `## Voice` section is scoped to a repository-root README and yields to `write-human`'s reference voice everywhere else
- Detect every project type the standard's `## Content` list applies to, from the manifest and the tree, rather than drafting against the closest single type
- Treat an existing README with no H1, or with headings that name only the scaffold that wrote it, as unedited generator output to draft over rather than a page to sync section by section
- Read the header block's slots off the repository, being the mark, the claim, the live link, and the product screenshot, and skip the link and the screenshot for a project with no page, so every element traces to a file or field the project holds
- Verify a candidate badge by the value it would render rather than by a fetch's status code, since a badge service answers 200 for a query it cannot satisfy
- Confirm the resolved path, the detected types, the badge candidates, and the full content with the user before writing, since project-type detection and badge selection are judgment calls with no diff to preview them against

## Must not

- Rewrite an authored README. One carrying an H1 that names the project refuses toward `docs-sync`.
- Offer to overwrite an authored README on the refusal path, or propose conforming it to what this skill would have drafted. A target project's own citations into its README are invisible from here, so the refusal reports rather than proposes.
- Invent a screenshot or a mark the project does not hold, or write a placeholder path for one. An omitted slot is a correct page and an invented image is the failure.
- Assume this skill's own invocation frequency needs no check. Whether anything reaches for it beyond an author typing its name has no answer at creation time, so a review pass some months in should read that back rather than take the assumption on faith.

## Guards

- The target already exists and is authored, carrying an H1 that names the project: stop and point at `docs-sync` instead.

## Out of scope

- Rewriting or syncing an existing authored `README.md` against a diff since main: `docs-sync`
- The consumer-facing reference under `docs/`: `draft-docs`
- Product scope and goals, and every other surface `standards/readme.md` already scopes out of its own governance
