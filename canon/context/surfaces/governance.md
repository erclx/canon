---
title: Governance
description: Path-scoped Claude rules with their naming, frontmatter, and routing contract, the stacks that group them, and the install and sync path with its CLI
---

# Governance

## Overview

Owns the rules that steer AI agents working in a project. Source rules are `.md` files under `governance/rules/` already carrying the Claude shape, and install copies them unchanged to `.claude/rules/canon/<folder>/<slug>.md` in a target. Stacks group rules so one install provisions a toolchain. The domain is a catalog plus a command surface.

## Layout

### `governance/rules/`

Holds the source rules, one subfolder per audience, each at `<folder>/<slug>.md` with no number and a basename that is unique and never a folder name.

- `code/`, `claude/`, `canon/`, `tooling/`, and `writing/` serve a project's code, session conduct, workflow, dev setup, and prose, and `lang/`, `framework/`, `lib/`, and `ui/` are opt-in
- A rule with `paths:` loads when Claude reads or writes a matching file, one without always applies like `CLAUDE.md`, and the Cursor keys `globs`, `alwaysApply`, and `priority` must not appear
- A `description` with a bare word, a colon, and a space breaks `Bun.YAML.parse` and lists the rule as unscoped, so rephrase it rather than quote it
- Adding a rule means creating the file, committing the regenerated `.claude/rules/` copy, and running `canon gov counts` until clean, as authored, consumed, and `base` counts move apart
- A rule in `code/` reaches every language stack, and one elsewhere reaches nobody until a stack or detect names it, so its glob should cover every ecosystem it governs

### `governance/ledger/`

Holds the source ledger for each outside-practice rule at the rule's own path, outside the installed tree so a ledger never loads or ships.

- `canon gov audit` matches a ledger's table rows to the rule's bullets by count under each H2 of the same name, so a row added or dropped without its bullet fails the folder
- A cut bullet goes in a `## Declined` list rather than a table, since every table row under a heading counts as a bullet's row
- Every `PRACTICE_FOLDERS` entry is gated, so a new outside-practice rule fails the push until its ledger lands, and `RULE_GATE_EXEMPT` spares `ui/canvas.md` alone until v149.2
- A ledger whose rule names a version-bound API records the major in the `Read` column
- A `|` inside a code span still splits a table cell, so a glob such as `@(spec|test)` in a ledger row is written `@(spec\|test)`

### `governance/stacks/`

Holds one `.toml` per stack with an optional `extends` and a `rules` list, where an entry names a rule or a whole rule folder.

- `expandStackEntry` in `src/gov/stacks.ts` turns a folder name into every rule inside it, and dedupe runs on the expanded names
- `base` names ten rules one by one, so a rule authored later under `canon/` or `claude/` reaches no project until it is added there or proposed by detect
- `node`, `python`, `go`, and `php` extend `base` and take `code` whole plus their language and testing rules, and there is no stack per framework
- Adding a stack means creating the `.toml`, setting `extends`, and listing rule names without `.md`, taking a folder whole only when it wants every rule there now and later
- `--add` takes rule names alone, warns on an unknown name, and with no stack named skips `writeChainStamp`, so the target keeps its recorded chain

### `governance/detect.toml`

Holds one table per opt-in rule, keyed by rule basename, listing the dependencies and file globs that mark a project as wanting it.

- `canon gov detect` reads the target's manifests and git-listed paths to depth two, skips what the caller's stack resolves, and returns each match with its evidence
- The `Unreferenced rules` stage fails on a rule no stack names and no table proposes, and on a table naming no live rule
- `nextjs` is proposed from `next` in a manifest or a `next.config.*` file, since it globs every `.ts` and `.tsx` file
- `security-server` and `database` glob Python, TypeScript, JavaScript, Go, and PHP, and `security-web` globs component and markup files alone

### `src/gov/`

Owns the gov half of every verb, being the stack reader, the rule lookup, the catalog behind `list`, the install copy, the sync adapter, the citation, restated, and rule shape checks, and the payload builder behind `build`. Frontmatter stripping lives in `src/markdown/frontmatter.ts`, which `docs` shares, and is never duplicated here.

- `install` bootstraps a stack and overwrites, `sync` refreshes only what is installed and never adds, and `build` writes the paste payload
- `gov list --json` carries `unreferenced` and `staleDetect` beside `stacks` and `rules`, and `recordStamp` holds the file hashes while `writeChainStamp` holds the stack name
- `src/sync/engine.ts` runs the scan, prompt, and apply loop, and matches an installed rule to its source by name so a moved rule syncs into the subfolder the target uses
- `canon gov citations` gates on a dead rule citation or internal glob, and `canon gov audit` on a rule past a shape limit or short of a ledger in a gated folder, bar an exempt file
- `canon gov install` and `sync` refuse the toolkit root, `regen` runs there on purpose, and `CANON_NON_INTERACTIVE=1` takes each confirm's first option but not the stack picker

### `claude/skills/create-rule/`

Holds the standard for what a rule states, being its shape limits, content test, and one-copy test, and the bullet checklist `create-rule` runs over a rule after writing it.

- A rule passes when its invariant fires on a path edit and violating it ships silently, and a rejected candidate is recorded by which half failed
- A claude rule carries at most five directives beside its pointer, since past that it reproduces the standard's structure rather than what must not go wrong
- A rule loads with no skill context, so `${CLAUDE_SKILL_DIR}` expands to nothing and the rule names the owning skill by its `canon:` name
- Test the target skill for a guard before writing `Load`, since `teach-workspace` refuses or starts a workspace where `write-human` only advises
- A standard a target never authors is routed by an `internal/rules/` rule, and `tasks.md` globs the whole task folder and sends the session handoff to `canon:session-map`

### `internal/`

Holds `governance.toml`, which names the one stack and extras this repository consumes, and `rules/` for toolkit authoring alone.

- `canon gov regen` resolves the record through the install machinery into `.claude/rules/canon/`, and `internal/rules/` installs beside it into `.claude/rules/internal/`
- A new rule must be named in a stack, the record's `add` list, or `internal/rules/`, since the drift assertion passes on a rule nothing names
- Nothing mirrors `internal/` into a path this repository resolves, and `internal/rules/claude/authoring-layout.md` states the root each carrier resolves against
- A target's own rules go to `.claude/rules/project/<subdir>/` through `create-rule`, and `canon gov sync` never reads them
- A file under `.claude/rules/canon/` that no source names is `orphaned` with no destination offered

### Other folders

A few more surfaces shape where a rule lands.

- `.claude/rules/` is produced output, so a hand edit is deleted on the next `bun run check` and the change belongs in the source or the record
- `governance/renames.toml` carries one entry per renamed shipped rule so `canon gov sync` moves a target across
- `claude/skills/git-commit/references/versioning.md` governs no file, so skill instruction reaches it rather than a rule
- A project holding `.cursor/rules/` from an older toolkit keeps those files, since sync never touches them

## Gotchas

- A widened source rule fails `bun run check` until its consumed copy is committed, and no stage reports a glob that matches nothing after the files it governs move
- Sync never retracts a rule a stack stopped naming, and `locateSource` matches a held basename in any folder, so a moved rule reaches new installs only
- A target on the flat `.claude/rules/<subdir>/` layout loads two copies of an edited rule until `canon migrate rule-layout` runs, and neither bootstrap verb sees it
- `src/comments/vocabulary.ts` reads whichever rule publishes `## Degradation vocabulary`, so adding that heading elsewhere changes what `canon comments scan` sweeps for
- A shipped rule naming a plugin skill or a `canon` verb can point at something a governance-only target lacks, so it carries a report-if-missing line
