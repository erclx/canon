---
title: Overview
description: What the plugin domain owns, where its boundary sits, and the layout of the plugin root
---

# Overview

Owns everything the toolkit ships outward under the Claude domain: the plugin skills in `claude/skills/`, the plugin manifest, and the `canon claude` CLI that seeds `.claude/` and `CLAUDE.md` into a target project. Internal skills that never leave this repo live in `canon/context/claude-internal/`.

## Layout

- `claude/` is the plugin root, the directory a marketplace entry sources
- `claude/skills/` owns the plugin skills, auto-discovered from the plugin root
- `claude/skills/<skill>/REQUIREMENT.md`: required sibling of `SKILL.md` holding the skill's gap statement, inert at load time
- `claude/.claude-plugin/` owns `plugin.json`, the plugin manifest. Its `name` field is `canon`, which is what namespaces every invocation as `/canon:<skill>`, and its `version` is written by the release automation rather than by hand
- `.claude-plugin/` at the repository root owns `marketplace.json`, the catalog an installer adds
- `claude/standards` is a symlink to the root authoring source, present so the files ship with an install

## Decisions

### Two delivery paths rather than one

`canon` commands copy governance rules, tooling configs, and design files into a project, and the marketplace plugin loads skills live from `claude/`. Copied content is what a project edits and owns, so it lands as files under version control.

A skill is toolkit-owned process that goes stale the moment it is copied. A single channel was the alternative, and neither channel does the other's job. The cost is a citation crossing the split: a skill naming an installed path resolves only where that install ran. So a file only one skill reads travels inside that skill.

Revisit when a plugin install can write files a project then owns, or a copied skill is re-synced on every session.

### Skills call the CLI and never reimplement it

A plugin skill reads a catalog through `canon <domain> list --json` and acts through the CLI under `CANON_NON_INTERACTIVE=1`. Every domain owes a `list --json` verb, and no skill hardcodes a rule or stack name, which keeps one behavior in one place.

Restating catalogs in skill bodies was the alternative, and it drifts on its own cadence. The rule covers catalogs, not documents: a skill reads a standard by path off the `claude/standards` symlink, and a rule names `canon standards <name>`, since a rule loads with no skill context.

Revisit when skills failing on a verb the installed binary lacks outnumber the drift restated catalogs would cause.

## Why this domain is a folder

A domain this size stays contended as one file: the skill catalog, the shell-out pattern, and the per-skill reasoning for a corpus this large all sit behind one file that almost any skill change writes. Splitting by sub-area gives each one a file that no unrelated change is also writing, and it is what keeps a reader from meeting a claim the entry already states elsewhere against the same subject.

The catalog is a bullet list rather than a table, per `standards/context.md`. A table pads its columns to a shared width, so a description outgrowing its column reflows every row and turns a one-row edit into a whole-file rewrite. A bullet list carries no shared column to reflow.

The sub-areas below are the units a session actually arrives looking for.
