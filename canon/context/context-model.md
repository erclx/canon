---
title: Context model
description: How project context splits across loading tiers and roots, the test that sorts a fact between them, and the folder index.md catalog system
---

# Context model

## Overview

Governs how a project lays out agent context and every entry in `canon/context/`. Three tiers load differently. `CLAUDE.md` and `canon/REQUIREMENTS.md` load always, `.claude/rules/<scope>.md` loads on a `paths:` glob match, and `canon/context/` entries load on demand through their catalog.

## Layout

### `canon/context/`

Holds one folder per kind of domain, such as `development/`, `surfaces/`, `features/`, and `workflow/`, with `context-model.md` beside them at the root. Each folder and the root carry a generated `index.md`, so a session picks an entry before touching the domain.

- A fact goes to `.claude/rules/` when it fires on a path being edited and violating it ships silently, otherwise to an entry or a skill body
- A rule also buys conditional presence and a fix that governance sync carries to every project, which an eager `CLAUDE.md` line cannot
- `index.md` is regenerated from each entry's `title` and `description` and is never hand-edited
- An entry is created by hand to the shape in `claude/skills/context-fold/references/context.md`, which `context-fold` then keeps current at ship time and never creates
- The stacks ship `development/setup.md` and `development/ci.md` as user-owned seeds under `tooling/base/seeds/canon/context/`, so check both sources before calling an entry absent

### `canon/`

Holds what the toolkit authors and commits, while `.claude/` holds what Claude Code reads by path and `.canon/` every gitignored session record. A committed file leaves `.canon/` first, and a path Claude Code reads then separates `.claude/` from `canon/`.

- `canon/` holds `context/`, `config/` with `baseline.json`, `pr-labels.toml` and the install stamp, `REQUIREMENTS.md`, and `DESIGN.md`
- `.claude/` holds `settings.json` with its per-machine `settings.local.json`, `hooks/`, `skills/` for the internal skills, `rules/`, and `worktrees/`
- `.canon/` takes one bare ignore line that covers a record folder added later
- `canon migrate records` moves untracked record folders under `.canon/`, with `RECORD_ROOTS` resolving the old root behind the new one and `CREATION_ROOT` naming where new ones land
- `canon migrate surface-roots` moves the committed surfaces with `git mv` and rewrites their citations

### `src/indexes/`

Parses frontmatter, walks folders, renders each `index.md`, and flattens the catalog for `canon indexes list`.

- Every `index.md` carries `title` and `subtitle`, every sibling `*.md` carries `title` and `description`, and a folder missing either fails
- A sibling renders as `- [title](file): description` and a subfolder with an `index.md` as `- [child title](child/index.md): subtitle`
- A sibling declaring `category` switches its folder to grouped mode, which emits an H2 per category and appends sub-catalogs under `## Sub-catalogs`
- Regen auto-stages the `index.md` files it rewrites when given positional paths in a git repository, and `--no-stage` opts out
- `list` matches a topic against every entry's `title`, `description`, and path rather than its contents

### Other folders

Three more paths belong to the catalog system.

- `src/commands/indexes.ts` owns the command surface, and `docs/agents/indexes.md` the flags and exit codes
- `claude/skills/target-setup/references/indexes.md` owns the bootstrap, reached as the `indexes` phase of `target-setup`
- `tooling/claude/seeds/.claude/hooks/index-reminder.sh` owns the reminder to read the nearest `index.md` before a `Grep` or `Glob`

## Gotchas

- A child folder with no `index.md` drops out of every catalog and regen still reports success, so create the child index in the same change as the folder
- One unparseable sibling leaves every `index.md` in its folder unwritten, and a `description` opening with a backtick or colon, or holding `: `, needs quotes
- `walkEntries` in `src/docs/read.ts` globs `*.md` one level deep, so turning an entry into a folder drops it from `docs list` silently and strands its relative links
- A gitignored folder takes a positional regen but not a whole-repo walk, and a shell `mv` fires no hook, so run `canon indexes regen` after moving an entry
- Hand-written prose in an auto-managed `index.md` is overwritten unless it sets `auto: false`
