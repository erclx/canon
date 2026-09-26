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

## Why this domain is a folder

A domain this size stays contended as one file: the skill catalog, the shell-out pattern, and the per-skill reasoning for a corpus this large all sit behind one file that almost any skill change writes. Splitting by sub-area gives each one a file that no unrelated change is also writing, and it is what keeps a reader from meeting a claim the entry already states elsewhere against the same subject.

The catalog is a bullet list rather than a table, per `standards/context.md`. A table pads its columns to a shared width, so a description outgrowing its column reflows every row and turns a one-row edit into a whole-file rewrite. A bullet list carries no shared column to reflow.

The sub-areas below are the units a session actually arrives looking for.
