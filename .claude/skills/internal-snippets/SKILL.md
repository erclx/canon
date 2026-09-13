---
name: internal-snippets
description: Reusable prompt snippets for Claude and Gemini. Use for adding snippets, renaming slugs, or editing snippet folder structure.
---

# Snippets

Read `canon/context/snippets.md` for system overview, categories, and structure before editing.

## Authoring rules

- Kebab-case only, no capitals, no underscores.
- Plain markdown only. No YAML frontmatter.
- No user fill-in placeholders. If a value depends on context, the user adds it after invocation.
- Use `canon snippets create` to add a snippet. To add manually: create a `.md` file in the correct folder.
- Admission and placement follow the cadence and audience tests in `standards/snippets.md`. Read them before adding a snippet or judging one already in the catalog.
- Those tests land here as three folders. `snippets/` holds what a target invokes with no project files behind it, `snippets/claude/` what reads or writes a project's own files, and `internal/snippets/` what only this repository runs, which the plugin never ships.

## Presets

`snippets/snippets.toml` defines virtual presets (curated slug lists) alongside folder-derived categories. Folder-based categories (`base`, `claude`) need no toml entry. Neither resolves against an install argument any more: `canon snippets install` retired with the domain's copy path, and a snippet now reaches a session at its `@` reference through the plugin's live `claude/snippets` symlink. Presets and categories still matter as the groupings `canon snippets list` reports.

- Slugs may include a folder prefix (`claude/feature-recap`), which is also the `@`-reference path a session types to reach one.
- New presets append a section to `snippets.toml` and nothing else. `canon snippets list` resolves them at runtime, so the context entry holds no preset row.

## Adding checklist

When adding a snippet:

- Place the file in `snippets/{category}/{name}.md` (or `snippets/{name}.md` for base)
- Leave `canon/context/snippets.md` alone unless the layout or a decision changed. `canon snippets list` is the catalog, so the entry keeps no per-snippet or per-category record to update.
- If the snippet belongs in `essentials`, add it to `snippets/snippets.toml`

When renaming a snippet:

- Update any `snippets.toml` preset entries that reference the old slug
- Update any project's own citation of the old `@`-reference path. Nothing syncs a project's prose for it.

## Reference

- `canon/context/snippets.md`: system overview, categories, CLI
- `standards/snippets.md`: what a snippet is, invocation channels, use patterns, authoring conventions
