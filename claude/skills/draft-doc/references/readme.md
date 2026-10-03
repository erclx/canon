---
title: Readme kind
description: The target default, authored-versus-scaffold guard, project detection, header block, and badges for a README.md, read by draft-doc once the request resolves to the readme kind
---

# Readme kind

`draft-doc` reads this file when the request resolves to a `README.md`. An authored README is rewritten by `docs-sync`, never drafted here.

The readme standard claims the voice of a repository-root README. `write-human` yields voice there and keeps rhythm, density, and the machine-tell catalog everywhere, the root README included.

## Guards

- Default the target to `README.md` at the repository root when no path is given. A caller naming a path under a folder, a harness, or an internal tool is drafting a nested README instead, which keeps the reference voice per the standard's `## Voice` section rather than the root voice.
- Read the target if it exists.
  - It carries an H1 naming the project: it is authored. Stop: `❌ <path> already exists and covers the project. Run canon:docs-sync instead.` Report rather than offering to overwrite it or to conform it to what this kind would draft, since the project's own citations into its README are invisible from here.
  - It carries no H1, or its only headings restate the tool that scaffolded it rather than the project: it is unedited generator output. Continue, drafting over it rather than syncing its sections.
  - It does not exist: continue.
- A hand-authored README opening with a badge block, or a title in some other form the H1 test misses, falls into the no-H1 branch the same as a scaffold page. The Confirm step is what catches that case before the write happens, so treat it as load-bearing rather than a courtesy: never skip it on the reasoning that the guard already decided.

## Placement

The target path is the placement. A README keeps no catalog, so there is no collision check beyond the guard above.

## Detect

Read the project's manifest (`package.json`, `pyproject.toml`, `Cargo.toml`, or equivalent) and the tree, then test each type on its own signal. Note every type that matches rather than stopping at the first, since a project is often several at once.

- Library: an installable package name, counted only when no other type below matches, since a named package is also what a site, a CLI, or a plugin carries.
- CLI: a `bin` field, a `[project.scripts]` table in `pyproject.toml`, a `[[bin]]` table in `Cargo.toml`, or a CLI entry point.
- Application: a site framework dependency, a site config file, or an app entry point.
- Agent-facing: a `.claude/skills/` folder, or a file an agent loads such as `CLAUDE.md`.
- Plugin: a `plugin.json` or a marketplace manifest.

A match on no type falls back to the standard's generic template. Say so in the preview, and never force the nearest type.

- Check for a page. A dependency on a site framework or a site config file in the manifest or the tree marks a project as having one. Read a live URL separately, from a `homepage` field or a deploy config, since a project can have a page and no known URL.
- A monorepo can carry a page in one package and a CLI in another, so both signals may fire. Report each rather than picking one.
- Look for the mark and the screenshot among images the project already commits: scan the existing README for image references, then the asset and public folders.

## Pick

Read the template for each detected type from `readme/`, beside this file:

- `readme/library.md`
- `readme/cli.md`
- `readme/application.md`
- `readme/agent-facing.md`
- `readme/plugin.md`

Each is a whole page of slots and structure, so fill it from the manifest and the tree rather than from memory. The standard still owns voice and content, and a template carries no rule of its own.

A project matching one type drafts from that template. A project matching several combines them:

- Keep one H1, one header block, and one description.
- Order the sections as the standard orders them.
- Add each extra type's usage or install subsection under the shared `## Installation` or `## Usage` H2, never as a second H2 of the same name.
- Drop a template section the page already carries rather than repeating it.

Between agent-facing and plugin alone, a repository with no plugin manifest takes only the agent-facing template, and a plugin that is not agent-facing in its own repository takes only the plugin template. A CLI or an application that also matches agent-facing keeps its own template beside it.

## Draft

- Start from the picked or combined template. Draft the H1, a 2-3 sentence description in plain text, then the required sections, then whichever optional sections and per-type content Detect found. A README takes no frontmatter.
- Open the page with the standard's header block, filling each slot from what Detect found: mark, title, badges, a one-line claim from the manifest description, the live link, then the product screenshot.
- Fill the screenshot slot only with an image the project already commits, referenced with alt text naming what it depicts. This kind cannot capture one. Omit the slot when no such image exists and say so in the preview. Never write a placeholder path or invent a mark.
- Omit the link and the screenshot for a project with no page, and the mark for a project with none, without a note in the drafted page. A project with a page and no known URL gets the screenshot slot, and the Confirm step asks for the link.
- Cover every applicable project type from the standard's `## Content` list rather than picking the closest one.
- Candidate badges: check for a published package (a registry field in the manifest), a CI workflow, and a `LICENSE` file.
- State each candidate's rendered value in the preview rather than trusting a fetch's status code, since a badge service answers 200 for a query it cannot satisfy.
- Pin a status badge to the branch the standard names and confirm the workflow actually triggers on that branch before offering it. Zero badges is a correct answer when nothing passes the test.

## Preview

Add these lines, then confirm them with the path:

- `**Target:** <root | nested>`
- `**Detected:** <project types>`
- `**Templates:** <each template read, or the generic fallback>`
- `**Header:** <each slot as filled (source) or skipped (reason)>`
- `**Badges:** <candidates and what backs each one, or none>`

The skill can confirm that an image file exists and is referenced, and it cannot verify the picture shows the product. Ask the user to look at it in the preview.

## Write

A README keeps no catalog, so skip the regen.
