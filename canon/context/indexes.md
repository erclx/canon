---
title: Indexes
description: Folder index.md system, frontmatter contract, when to adopt
---

# Indexes system

## Overview

Owns the `index.md` catalog system. Folders that an agent browses to pick a document carry one. The CLI walks the project, reads each folder's frontmatter and its siblings' `title` and `description` fields, and rewrites `index.md` so the catalog stays in sync with the files. Agents read one file to know what every sibling does instead of opening each one.

## Layout

- `src/indexes/` owns the engine: frontmatter parsing, the walker, the renderer, regen orchestration, and `list.ts`'s catalog flattening
- `src/commands/indexes.ts` owns the command surface
- `claude/skills/target-setup/references/indexes.md` owns the bootstrap procedure, reached as the `indexes` phase
- `claude/skills/index-lookup/` owns the topic-search skill wrapping `list`

## Decisions

- The system is opt-in per folder. A project that does not need browseable catalogs gets no value from adopting it, so nothing is indexed by default.
- The frontmatter contract is all-or-nothing per folder. A partial migration produces an `index.md` that hard-errors on the next regen, which surfaces the gap immediately instead of shipping a half-populated catalog.
- The bootstrap skill is the only supported migration path. The CLI does not own it because authoring readable `description` text is judgment work, not a deterministic transformation.
- Regen auto-stages rewritten `index.md` files when positional paths are passed inside a git repository. Without it, a commit that stages a sibling frontmatter change would land with a drifted `index.md`, because `lint-staged` re-stages only files that were in the original staged set.
- Both integration points are opt-in per project and the toolkit ships no default. Git-driven projects want `lint-staged`, agent-driven ones want the hook, and picking one for them would be wrong half the time.
- The engine reads frontmatter with `Bun.YAML` and emits JSON with `JSON.stringify`, so neither the parser nor the escaping is hand-rolled.
- Frontmatter is re-emitted verbatim rather than re-serialized from the parsed object. Key order, comments, and the `auto: false` marker all survive a regeneration that way.
- Flat mode sorts sub-catalogs among the sibling files instead of appending them. A folder and a file are both one domain to a reader scanning the catalog, and the rendered lines are indistinguishable, so a trailing entry reads as absent from the alphabetical run it belongs in.
- Grouped mode keeps the append, since its heading is what makes the child catalogs visible in a catalog `CLAUDE.md` loads every session.
- `list` ships with a dedicated lookup skill, `index-lookup`, which matches a topic against every entry's `title`, `description`, and `path` rather than searching file contents. The skill names, rather than searches, a folder sitting outside `list`'s walk, checking which ones a project carries before naming any, since widening `list` to reach them stays declined per the gotchas below.

## Gotchas

- Hand-written content in an auto-managed `index.md` is overwritten on the next regen. Set `auto: false` to keep prose.
- A child folder whose `index.md` is missing `title` or `subtitle` is skipped with a warning rather than failing the walk.
- A child folder carrying no `index.md` at all drops out of every catalog silently. `collectEntries` globs the folder's own `*.md` and never recurses, so the pages inside surface neither as parent entries nor as a sub-catalog line, and the regen reports success. Create the child index in the same change that creates the folder.
- When a folder has both an overview file and a same-named subfolder, both entries appear.
- Whole-repo walks with no positional paths never auto-stage.
- A gitignored folder is reachable by positional regen but invisible to a whole-repo walk. The walk filters candidates through `git check-ignore`, while `findIndexedAncestor` walks the filesystem and never consults git. `.canon/tasks/` and `.canon/memory/` both depend on that asymmetry: `bun run check` cannot regenerate either, so a `PostToolUse` hook passes the changed path instead.
- Staging is skipped on an ignored path, since `git add` there always fails and the warning would fire on every edit
- A hook keeping such a folder current matches tool names, `Write|Edit|MultiEdit`, so a file relocated by a shell `mv` fires nothing and the index keeps a row for a file that has moved. A skill that archives or relocates an entry calls `canon indexes regen` itself after the last move rather than relying on the hook.
- A positional path resolves against the working root, so a path outside it is dropped and the run frames a success having written nothing. Passing `--root <main-root>` is what carries a regen from a linked worktree to an index in the main checkout, and `--json` is what separates a written index from a skipped one, since the framed output names neither.
- A frontmatter failure takes the whole folder rather than the one file. `collectEntries` returns an error for the directory, so one unparseable entry leaves every sibling's index unwritten.
- The same failure drops a folder out of `list`'s catalog without failing the whole command. `buildIndexCatalog` isolates the error into its `errors` array and keeps walking, so a caller reading `entries` still gets every conforming folder even though the run's exit code reports the miss.
- `index-lookup` inherits both boundaries above rather than working around them. A gitignored indexed folder never reaches `entries`, and a README-based record catalog such as `.canon/groundwork/` carries no `index.md` frontmatter for `list` to read at all, so the skill names either kind as a folder to check by hand instead of matching a topic inside it.

## When to adopt

Adopt for folders an agent browses to pick a document. Skip for code folders, generated docs, single-file directories, and folders where files resolve by path convention.

Concrete fit:

- Markdown-heavy reference folders (docs sites, knowledge bases, prompt libraries, design tokens)
- Folders with three or more sibling markdown files that have distinct purposes
- Catalogs a skill or script needs to discover at runtime instead of hardcoding names

Concrete miss:

- `src/`, `lib/`, or any code folder. Agents traverse code by import graph, not by description
- Generated docs (API references, changelogs). The frontmatter cost outweighs the navigation gain
- A `docs/` with one `README.md` and a couple of supporting files. `ls` is cheaper

## Frontmatter contract

Every `index.md` carries `title` and `subtitle` in its own frontmatter. Every sibling `*.md` carries `title` and `description`. The walker fails the folder when any sibling lacks either field.

`category` on a sibling groups it under an H2 heading in the rendered index. When any sibling carries `category`, the walker switches to grouped mode for the whole folder. The value is sentence case, since it is emitted as the heading verbatim.

The field is all-or-nothing per folder, the same shape the `title` and `description` contract carries, and calling it optional per page reads as a choice each sibling makes. `renderIndex` builds its heading set from the declared values and skips every entry failing `entry.category !== category`, so a sibling declaring none in a grouped folder lands in no heading and no ungrouped section is written for it. The page drops out of the catalog and the regen reports success.

A child folder's own `index.md` `category` reaches nothing in the parent. `readCatalogs` reads `title` and `subtitle` off a child index and never its `category`, and grouped mode collects every child under the trailing `## Sub-catalogs` heading, so a child index declaring the category its pages left does not rejoin that heading.

Quote a `description` opening with a backtick or a colon. YAML reserves both at the start of a scalar, so `Bun.YAML.parse` rejects the block and the folder fails per the rule above. `parseFrontmatter` reads a block that will not parse as absent, so the error names the file as missing its `title` and `description` even though it carries both. A hand-maintained catalog never exercises the parser, so a folder converting to generation surfaces these on its first regen rather than as it grew.

## Format reference

The walker generates the `index.md` body from sibling frontmatter on every regen. The output shape is fixed and applies uniformly to every indexed folder (`wiki/`, `docs/`, `standards/`, `canon/context/`, and any future indexed surface).

Sibling frontmatter (per `*.md` file in the folder):

```yaml
---
title: Web
description: Next.js app structure, layers, and conventions
---
```

Index frontmatter (per `index.md`):

```yaml
---
title: Context
subtitle: Per-domain narrative loaded on demand
---
```

Generated body (flat, no `category` on any sibling):

```markdown
# Context

Per-domain narrative loaded on demand

- [Web](web.md): Next.js app structure, layers, and conventions
- [API](api.md): FastAPI routes and storage
```

Generated body (grouped, when at least one sibling has `category`):

```markdown
# Docs

One-line reference for each doc in this folder.

## Agent surface

- [Agents](agents.md): CLI catalog and invocation rules for agents
- [AI workflow](ai-workflow.md): Overarching AI workflow across domains

## Domain references

- [Claude plugin](claude-plugin.md): Plugin skills shipped to target projects
- [Tooling](tooling.md): Stacks, configs, seeds, references, manifests
```

Generated body (with a nested subfolder):

```markdown
# Context

Per-domain narrative loaded on demand

- [Web](web.md): app structure and routing
- [Workflows](workflows/index.md): per-pipeline reference
```

A folder that holds its own `index.md` is a child catalog. The parent links it so an agent reading the parent discovers the sub-catalog without opening files. Linking is recursive because each folder regenerates independently.

Two trees in this repository nest. `canon/context/` mixes flat entries with five child catalogs, and `wiki/` pushes every page into `claude/`, `tools/`, or `concepts/` so its root index carries sub-catalog lines alone.

The H1 mirrors the `title`. The lead paragraph mirrors the `subtitle`. Each sibling file renders as `- [<title>](<filename>): <description>`. Each immediate subfolder that carries an `index.md` renders as `- [<child title>](<child>/index.md): <child subtitle>`, sorted among the sibling files by name rather than appended after them.

In grouped mode those folder entries collect under a trailing `## Sub-catalogs` heading instead, since a category is the organizing key there and alphabetical position carries no meaning.

## Opt-out

Add `auto: false` to a folder's `index.md` frontmatter to keep it hand-edited. The walker preserves the file untouched. Use this when the folder needs grouping or prose the walker cannot produce from frontmatter alone.

## Maintenance

Two integration points keep `index.md` files current after edits.

`lint-staged` is the recommended option for git-driven projects:

```json
{
  "**/*.md": "canon indexes regen"
}
```

`lint-staged` appends changed paths as trailing arguments. The CLI walks up from each path to the nearest indexed ancestor and regenerates only affected folders. Pass `--no-stage` to opt out of auto-staging, for example when partial-staging with `git add -p` and deliberately excluding an index change.

A Claude Code `PostToolUse` hook on `Edit` and `Write` matching `**/*.md` covers projects that prefer agent-driven regeneration. The hook runs the same command and benefits from the same auto-stage behavior.

## Enforcement

The index system only pays off when sessions consult the catalogs instead of searching past them. The Claude seed ships a `PreToolUse` hook on `Grep` and `Glob` that walks up from the search path to the nearest `index.md` and reminds the agent to read it first, naming `canon indexes list --json` and the `index-lookup` skill alongside the local path as the cross-folder answer. It fires once per folder per session and only where an index exists, so it self-scales to a project's index density. See `canon/context/claude-plugin/cli.md` for the seed settings block.

## Bootstrap

Use the `target-setup` plugin skill's `indexes` phase to add the system to a project that does not have it yet. The phase scans for markdown-heavy folders, drafts `title` and `description` for each sibling from its first heading and paragraph, scaffolds `index.md` per chosen folder, and runs `canon indexes regen --dry-run` to validate before writing.

## Command surface

See `docs/agents/indexes.md` for the `canon indexes regen` and `canon indexes list` invocation contracts: flags, exit codes, and JSON output shape.

## Related

- `docs/agents/indexes.md`: CLI flags, exit codes, JSON output
- `canon/context/cli/commands.md`: the TypeScript layer and the migration boundary
- `scripts/lib.md`: `lib/frontmatter.sh`, the one bash reader that stayed
- `claude/skills/target-setup/references/indexes.md`: bootstrap procedure source
