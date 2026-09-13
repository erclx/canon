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
- `claude/standards` and `claude/snippets` are symlinks to the root authoring sources, present so the files ship with an install

## Why this domain is a folder

The entry was one file until it became the seam every parallel branch met in. It held the skill catalog, the shell-out pattern, and the per-skill reasoning for a domain of 55 skills, so almost any skill change wrote it. Two collisions landed on one day: three branches rebased through it in sequence, and two more produced a content conflict in this file alone, because one widened a catalog column while the other edited a row of the same table.

The catalog was the sharpest edge. A markdown table pads its columns to a shared width, so a description outgrowing its column reflows every row and turns a one-row edit into a whole-file rewrite. The catalog is a bullet list for that reason, and `standards/context.md` records the rule. Splitting the file addresses the rest: a change to one sub-area now writes a file no unrelated change is also writing.

Contention was not the only cost. Two sessions in one day wrote claims the entry already contradicted rather than claims it did not cover, both against the same paragraph, which is what a file this size does to a reader. The sub-areas below are the units a session actually arrives looking for.
