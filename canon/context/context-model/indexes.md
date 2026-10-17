---
title: Indexes
description: Folder index.md system, the frontmatter contract and grouped mode, when to adopt, keeping indexes current, and the search reminder
---

# Indexes system

## Overview

Owns the `index.md` catalog system. Folders an agent browses to pick a document carry one. The CLI reads each folder's frontmatter and its siblings' `title` and `description` fields and rewrites `index.md`, so an agent reads one file to know what every sibling does.

`docs/agents/indexes.md` carries the `canon indexes regen` and `canon indexes list` invocation contracts, and any generated `index.md` here shows the rendered shape.

## Layout

- `src/indexes/` owns the engine: frontmatter parsing, the walker, the renderer, regen orchestration, and `list.ts`'s catalog flattening
- `src/commands/indexes.ts` owns the command surface
- `claude/skills/target-setup/references/indexes.md` owns the bootstrap procedure, reached as the `target-setup` skill's `indexes` phase

### Related

Two docs sit beside this entry.

- `docs/agents/indexes.md`: CLI flags, exit codes, and JSON output
- `canon/context/cli/commands/overview.md`: the TypeScript layer and the migration boundary

## Decisions

### Adoption is opt-in and all-or-nothing

The system is opt-in per folder, so nothing is indexed by default and a project that does not need catalogs pays nothing. The frontmatter contract is all-or-nothing per folder. A partial migration produces an `index.md` that hard-errors on the next regen, which surfaces the gap instead of shipping a half-populated catalog.

The bootstrap skill is the only supported migration path, because authoring readable `description` text is judgment work the CLI cannot do deterministically.

### Regen stages what it rewrites

Regen auto-stages rewritten `index.md` files when positional paths are passed inside a git repository. Without it, a commit staging a sibling's frontmatter change would land with a drifted `index.md`, because `lint-staged` re-stages only files in the original staged set.

Both integration points are opt-in per project and the toolkit ships no default. Git-driven projects want `lint-staged` and agent-driven ones want the hook, so picking one would be wrong half the time.

### Engine and catalog modes

The engine reads frontmatter with `Bun.YAML` and emits JSON with `JSON.stringify`, so neither the parser nor the escaping is hand-rolled. Frontmatter is re-emitted verbatim rather than re-serialized, so key order, comments, and the `auto: false` marker survive a regeneration.

- Flat mode sorts sub-catalogs among the sibling files, since a folder and a file are both one domain to a reader and a trailing entry reads as absent from the alphabetical run
- Grouped mode appends them under a trailing `## Sub-catalogs` heading, since a category is the organizing key there and the heading keeps child catalogs visible
- `list` matches a topic against every entry's `title`, `description`, and `path` rather than file contents. A folder outside its walk stays one the caller checks by hand.

### When to adopt

Adopt for folders an agent browses to pick a document, being markdown-heavy reference folders, folders with three or more sibling files of distinct purposes, and catalogs a skill or script discovers at runtime.

Skip code folders, since agents traverse code by import graph. Skip generated docs such as API references and changelogs, small folders where `ls` is cheaper, and folders whose files resolve by path convention.

- Add `auto: false` to keep an adopted folder's index hand-edited when it needs prose the walker cannot produce
- Add the system through the `target-setup` skill's `indexes` phase, which drafts each sibling's frontmatter from its first heading and paragraph and validates with a dry run before writing

### Keeping indexes current

`lint-staged` is the recommended option for git-driven projects.

```json
{
  "**/*.md": "canon indexes regen"
}
```

It appends changed paths as trailing arguments. The CLI walks up from each path to the nearest indexed ancestor and regenerates only affected folders. Pass `--no-stage` to opt out of auto-staging, for example when partial-staging with `git add -p`.

A Claude Code `PostToolUse` hook on `Edit` and `Write` matching `**/*.md` covers agent-driven projects, running the same command with the same auto-stage behavior.

### Enforcement

The system pays off only when sessions consult the catalogs instead of searching past them. The Claude seed ships a `PreToolUse` hook on `Grep` and `Glob` that walks up from the search path to the nearest `index.md` and reminds the agent to read it first.

- The reminder names `canon indexes list --json` alongside the local path as the cross-folder answer
- It fires once per folder per session and only where an index exists, so it scales to a project's index density
- `canon/context/claude-plugin/cli.md` carries the seed settings block

## Gotchas

### Regen behavior

Four behaviors surprise a first regen.

- Hand-written content in an auto-managed `index.md` is overwritten on the next regen. Set `auto: false` to keep prose.
- A child folder whose `index.md` is missing `title` or `subtitle` is skipped with a warning rather than failing the walk
- A folder with both an overview file and a same-named subfolder shows both entries
- Whole-repo walks with no positional paths never auto-stage

A child folder carrying no `index.md` at all drops out of every catalog silently. `collectEntries` globs the folder's own `*.md` and never recurses, so its pages surface neither as parent entries nor as a sub-catalog line, and the regen reports success. Create the child index in the same change that creates the folder.

### Positional regen and ignored folders

A gitignored folder is reachable by positional regen but invisible to a whole-repo walk. The walk filters through `git check-ignore`, while `findIndexedAncestor` walks the filesystem and never consults git. `.canon/tasks/` depends on that asymmetry, since `bun run check` cannot regenerate it and a hook passes the changed path instead.

- Staging is skipped on an ignored path, since `git add` there always fails and the warning would fire on every edit
- A hook matching `Write|Edit|MultiEdit` fires nothing for a file moved by a shell `mv`, so the index keeps a row for a file that has moved
- A skill that archives or relocates an entry calls `canon indexes regen` itself after the last move
- A positional path resolves against the working root, so a path outside it is dropped and the run frames a success having written nothing
- `--root <main-root>` carries a regen from a linked worktree to the main checkout's index, and `--json` separates a written index from a skipped one

### Failures

A frontmatter failure takes the whole folder rather than the one file. `collectEntries` returns an error for the directory, so one unparseable entry leaves every sibling's index unwritten.

- The same failure drops a folder out of `list`'s catalog without failing the command. `buildIndexCatalog` isolates the error into its `errors` array and keeps walking.
- A gitignored indexed folder never reaches `entries`
- A README-based record catalog such as `.canon/groundwork/` carries no `index.md` frontmatter for `list` to read
- A caller of `list` checks either kind of folder by hand instead of matching a topic inside it

### Frontmatter traps

`category` on a sibling groups it under an H2 heading, and any sibling carrying one switches the whole folder to grouped mode. The field is all-or-nothing per folder, like the `title` and `description` contract.

- `renderIndex` builds its heading set from the declared values, so a sibling declaring none in a grouped folder lands in no heading and the regen reports success
- A child folder's own `index.md` `category` reaches nothing in the parent, since `readCatalogs` reads `title` and `subtitle` off a child and grouped mode collects every child under `## Sub-catalogs`

Quote a `description` opening with a backtick or a colon, or carrying a colon followed by a space anywhere in it. YAML reserves the first two at the start of a scalar and reads the third as a mapping key, so `Bun.YAML.parse` rejects the block and the folder fails.

`parseFrontmatter` reads a block that will not parse as absent, so the error names the file as missing its `title` and `description` even though it carries both. A hand-maintained catalog never exercises the parser, so a folder converting to generation surfaces these on its first regen.

### Hidden contracts

The catalog format is fixed.

- Every `index.md` carries `title` and `subtitle` in its own frontmatter, and every sibling `*.md` carries `title` and `description`. The walker fails the folder when any sibling lacks either field.
- The H1 mirrors the `title` and the lead paragraph mirrors the `subtitle`
- Each sibling renders as `- [<title>](<filename>): <description>`
- Each immediate subfolder carrying an `index.md` renders as `- [<child title>](<child>/index.md): <child subtitle>`, and linking is recursive because each folder regenerates independently
- `category` on a sibling groups it under an H2 of that value, emitted verbatim, so it is written in sentence case
