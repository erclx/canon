---
title: Indexes
description: Folder index.md system, the frontmatter contract and grouped mode, when to adopt, keeping indexes current, and the search reminder
---

# Indexes system

## Overview

Owns the `index.md` catalog system. Folders that an agent browses to pick a document carry one. The CLI walks the project, reads each folder's frontmatter and its siblings' `title` and `description` fields, and rewrites `index.md` so the catalog stays in sync with the files. Agents read one file to know what every sibling does instead of opening each one.

`docs/agents/indexes.md` carries the `canon indexes regen` and `canon indexes list` invocation contracts, and any generated `index.md` in this repository shows the rendered shape, so this entry states the contract in brief and why the system is shaped the way it is.

## Layout

- `src/indexes/` owns the engine: frontmatter parsing, the walker, the renderer, regen orchestration, and `list.ts`'s catalog flattening
- `src/commands/indexes.ts` owns the command surface
- `claude/skills/target-setup/references/indexes.md` owns the bootstrap procedure, reached as the `target-setup` skill's `indexes` phase
- `claude/skills/index-lookup/` owns the topic-search skill wrapping `list`

## Decisions

- The system is opt-in per folder. A project that does not need browseable catalogs gets no value from adopting it, so nothing is indexed by default.
- The frontmatter contract is all-or-nothing per folder. A partial migration produces an `index.md` that hard-errors on the next regen, which surfaces the gap immediately instead of shipping a half-populated catalog.
- The bootstrap skill is the only supported migration path. The CLI does not own it because authoring readable `description` text is judgment work, not a deterministic transformation.
- Regen auto-stages rewritten `index.md` files when positional paths are passed inside a git repository. Without it, a commit that stages a sibling frontmatter change would land with a drifted `index.md`, because `lint-staged` re-stages only files in the original staged set.
- Both integration points are opt-in per project and the toolkit ships no default. Git-driven projects want `lint-staged`, agent-driven ones want the hook, and picking one for them would be wrong half the time.
- The engine reads frontmatter with `Bun.YAML` and emits JSON with `JSON.stringify`, so neither the parser nor the escaping is hand-rolled.
- Frontmatter is re-emitted verbatim rather than re-serialized from the parsed object. Key order, comments, and the `auto: false` marker all survive a regeneration that way.
- Flat mode sorts sub-catalogs among the sibling files instead of appending them. A folder and a file are both one domain to a reader scanning the catalog, and a trailing entry reads as absent from the alphabetical run it belongs in.
- Grouped mode keeps the append under a trailing `## Sub-catalogs` heading, since a category is the organizing key there and that heading is what makes the child catalogs visible in a catalog `CLAUDE.md` loads every session.
- `list` ships with a dedicated lookup skill, `index-lookup`, which matches a topic against every entry's `title`, `description`, and `path` rather than searching file contents. The skill names, rather than searches, a folder sitting outside `list`'s walk, checking which ones a project carries before naming any, since widening `list` to reach them stays declined per the gotchas below.

## Gotchas

- Hand-written content in an auto-managed `index.md` is overwritten on the next regen. Set `auto: false` to keep prose.
- A child folder whose `index.md` is missing `title` or `subtitle` is skipped with a warning rather than failing the walk.
- A child folder carrying no `index.md` at all drops out of every catalog silently. `collectEntries` globs the folder's own `*.md` and never recurses, so the pages inside surface neither as parent entries nor as a sub-catalog line, and the regen reports success. Create the child index in the same change that creates the folder.
- When a folder has both an overview file and a same-named subfolder, both entries appear.
- Whole-repo walks with no positional paths never auto-stage.

### Positional regen and ignored folders

- A gitignored folder is reachable by positional regen but invisible to a whole-repo walk. The walk filters candidates through `git check-ignore`, while `findIndexedAncestor` walks the filesystem and never consults git. `.canon/tasks/` and `.canon/memory/` both depend on that asymmetry: `bun run check` cannot regenerate either, so a `PostToolUse` hook passes the changed path instead.
- Staging is skipped on an ignored path, since `git add` there always fails and the warning would fire on every edit
- A hook keeping such a folder current matches tool names, `Write|Edit|MultiEdit`, so a file relocated by a shell `mv` fires nothing and the index keeps a row for a file that has moved. A skill that archives or relocates an entry calls `canon indexes regen` itself after the last move rather than relying on the hook.
- A positional path resolves against the working root, so a path outside it is dropped and the run frames a success having written nothing. Passing `--root <main-root>` is what carries a regen from a linked worktree to an index in the main checkout, and `--json` is what separates a written index from a skipped one, since the framed output names neither.

### Failures

- A frontmatter failure takes the whole folder rather than the one file. `collectEntries` returns an error for the directory, so one unparseable entry leaves every sibling's index unwritten.
- The same failure drops a folder out of `list`'s catalog without failing the whole command. `buildIndexCatalog` isolates the error into its `errors` array and keeps walking, so a caller reading `entries` still gets every conforming folder even though the run's exit code reports the miss.
- `index-lookup` inherits both boundaries above rather than working around them. A gitignored indexed folder never reaches `entries`, and a README-based record catalog such as `.canon/groundwork/` carries no `index.md` frontmatter for `list` to read at all, so the skill names either kind as a folder to check by hand instead of matching a topic inside it.

### Frontmatter traps

`category` on a sibling groups it under an H2 heading, and any sibling carrying one switches the whole folder to grouped mode. The field is all-or-nothing per folder, the same shape the `title` and `description` contract carries. `renderIndex` builds its heading set from the declared values and skips every entry failing `entry.category !== category`, so a sibling declaring none in a grouped folder lands in no heading, no ungrouped section is written for it, and the regen reports success.

A child folder's own `index.md` `category` reaches nothing in the parent. `readCatalogs` reads `title` and `subtitle` off a child index and never its `category`, and grouped mode collects every child under `## Sub-catalogs`, so a child index declaring a category does not rejoin that heading.

Quote a `description` opening with a backtick or a colon. YAML reserves both at the start of a scalar, so `Bun.YAML.parse` rejects the block and the folder fails. `parseFrontmatter` reads a block that will not parse as absent, so the error names the file as missing its `title` and `description` even though it carries both. A hand-maintained catalog never exercises the parser, so a folder converting to generation surfaces these on its first regen rather than as it grew.

## Hidden contracts

- Every `index.md` carries `title` and `subtitle` in its own frontmatter, and every sibling `*.md` carries `title` and `description`. The walker fails the folder when any sibling lacks either field.
- The H1 mirrors the `title` and the lead paragraph mirrors the `subtitle`. Each sibling renders as `- [<title>](<filename>): <description>`, and each immediate subfolder carrying an `index.md` renders as `- [<child title>](<child>/index.md): <child subtitle>`. Linking is recursive because each folder regenerates independently.
- `category` on a sibling groups it under an H2 of that value, emitted verbatim, so it is written in sentence case

## When to adopt

Adopt for folders an agent browses to pick a document: markdown-heavy reference folders, folders with three or more sibling markdown files that have distinct purposes, and catalogs a skill or script discovers at runtime instead of hardcoding names.

Skip code folders, since agents traverse code by import graph rather than description. Skip generated docs such as API references and changelogs, where the frontmatter cost outweighs the navigation gain, and a small folder where `ls` is cheaper. Skip folders whose files resolve by path convention. Add `auto: false` to keep an adopted folder's index hand-edited when it needs prose the walker cannot produce.

Add the system to a project that does not have it through the `target-setup` skill's `indexes` phase, which drafts each sibling's frontmatter from its first heading and paragraph and validates with a dry run before writing.

## Keeping indexes current

`lint-staged` is the recommended option for git-driven projects:

```json
{
  "**/*.md": "canon indexes regen"
}
```

`lint-staged` appends changed paths as trailing arguments. The CLI walks up from each path to the nearest indexed ancestor and regenerates only affected folders. Pass `--no-stage` to opt out of auto-staging, for example when partial-staging with `git add -p` and deliberately excluding an index change.

A Claude Code `PostToolUse` hook on `Edit` and `Write` matching `**/*.md` covers projects that prefer agent-driven regeneration, running the same command with the same auto-stage behavior.

## Enforcement

The system pays off only when sessions consult the catalogs instead of searching past them. The Claude seed ships a `PreToolUse` hook on `Grep` and `Glob` that walks up from the search path to the nearest `index.md` and reminds the agent to read it first, naming `canon indexes list --json` and the `index-lookup` skill alongside the local path as the cross-folder answer. It fires once per folder per session and only where an index exists, so it scales to a project's index density. `canon/context/claude-plugin/cli.md` carries the seed settings block.

## Related

- `docs/agents/indexes.md`: CLI flags, exit codes, and JSON output
- `canon/context/cli/commands.md`: the TypeScript layer and the migration boundary
- `canon/context/scripts/lib.md`: `lib/frontmatter.sh`, the one bash reader that stayed
