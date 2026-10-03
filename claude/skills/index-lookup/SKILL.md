---
name: index-lookup
description: Answers a topic search over every tracked index.md catalog in the project by running `canon indexes list --json` and matching the topic against each entry's title, description, and path, then reports the hits or names why there are none. Names the gitignored task, memory, and diagram catalogs and the groundwork and intake record folders as pointers outside its walked corpus, so it never claims a topic is undocumented when the topic only sits there. Use when asked "where is X documented", "is there a page about X", "search the docs for X", "find the index entry for X", or "what covers X". Do NOT use to grep source code, browse a file whose path is already known, or regenerate an index, which is `canon indexes regen`.
---

# Index lookup

Answers a topic search over the project's tracked `index.md` catalogs, not a text search over file contents. Matches a topic string against every entry's `title`, `description`, and `path`, drawn from wherever `canon indexes list --json` walks.

## Steps

1. Resolve the project root with `git rev-parse --show-toplevel`, falling back to the working directory when the read fails.
2. Run `canon indexes list --json` from that root.
3. Read `errors` first. A folder failing frontmatter validation drops out of `entries` and lands its message in `errors` instead, per the verb's own per-folder isolation, so report an error alongside the match rather than reading it as a reason to stop.
4. Match the topic case-insensitively as a substring against each entry's `title`, `description`, and `path`. Report every match. A lookup with no ranking is honest about what it found, and a single best guess is not.
5. Check whether the project carries a gitignored indexed folder or a README-based record catalog outside `list`'s walk: `.canon/tasks/`, `.canon/memory/`, `.canon/groundwork/`, `.canon/intake/`. Test each for existence and at least one file inside it before naming it. A folder absent from this project names nothing.
6. Report the hits, plus a pointer to any outside-the-walk folder found present, per Output below.

## Rules

- Report zero hits as zero hits, never as "not documented." The topic can sit inside a folder step 5 found and named, so an empty walked corpus is a fact about the search, not about the project.
- Never search file contents. A miss against `title`, `description`, and `path` is the whole answer, and a request that needs a text search calls for grepping the tree instead.
- Never regenerate or edit an index. Report an entry that reads as stale rather than running `canon indexes regen` on this skill's own initiative.
- Report an absent `canon indexes list` subcommand rather than falling back to a manual walk. It ships with the CLI, so a project on an older install meets a missing verb, and a hand-rolled walk here restates the CLI logic this skill exists to call instead.

## Output

```plaintext
Index lookup: "<topic>"

Hits:
- <path>: <title> — <description>

Outside the walked corpus (check by hand):
- <folder>: <one-line reason it sits outside list's walk>
```

Replace the "Hits" block with `No catalog entry matched "<topic>".` when nothing matched. Omit "Outside the walked corpus" when the project carries none of the five folders from step 5, or when every one it carries is empty.

## Reference

Run `canon docs indexes` for the `canon indexes list` flags, exit codes, and JSON shape. It resolves from the toolkit rather than from the target's own tree.
