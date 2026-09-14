---
title: Overview
description: What the standards domain owns, the trees a standard can live in, the command surface, and why the entry is a folder
---

# Overview

Owns the markdown docs defining developer workflow conventions, read by agents and developers alike. Standards cover workflow conventions, not code style. Code style belongs in governance rules.

Nothing installs the corpus into a project and nothing mirrors it under `.claude/` here. A reader resolves one instead: `src/standards/read.ts` searches `standards/` at the working directory, then the corpus the package ships in its `files` array, so `canon markdown audit` and `canon standards <name>` both answer in a project that carries no copy at all. A project that authors standards of its own wins on the first root, since a package copy overriding it would discard that edit with nothing said. `canon/context/standards/resolution.md` carries the routes and what closing each one removed.

## Layout

- `standards/` owns the authoring source, one file per installable standard
- `internal/standards/` owns toolkit-internal standards, outside anything the plugin ships

## Gotchas

### Why the entry is a folder

The entry is a folder on the sub-area condition rather than on length. `standards/context.md` splits a domain at three or more sub-areas that do not fit cleanly in one file, and the scope model, authoring, the per-standard decisions, and install and sync are four that do not, with the overview and the command surface a fifth. Length is what raised the question and answers nothing by itself.

A split buys relief rather than compliance. Every sub-file arrived under the 150-line checkpoint, which is better than the sub-area grouping guaranteed, since the groups are uneven and the largest of them lands on the checkpoint exactly.

Most oversized context entries elsewhere are already sub-files of a domain that split, so treat the headroom here as the thing to defend rather than as proof the checkpoint is settled. Read `canon context audit` for the live per-file numbers rather than recording them here, since a figure written into prose goes stale on the next edit and the audit does not.

A sibling domain asking the same question applies the condition against its own tree rather than inheriting this outcome. Deciding a split for an entry nobody has measured is the failure the question exists to catch.

## Standards

Run `canon standards list` for the catalog of installable standards and their descriptions.

`internal/standards/tooling-reference.md` governs `tooling/<stack>/reference.md` and is not in the installed set. The toolkit-local rule `.claude/rules/internal/claude/595-tooling-reference.md` routes edits to it at that authoring path, which is where its two readers sit.

## CLI

Run `canon standards --help` for the verbs and what each one does. Flags and arguments live in `docs/agents/scripting.md`.

`--json` emits `{standards: [{name, description, appliesTo, content}]}`. `content` carries the document itself, and `appliesTo` is the paths a standard's `## Scope` statement declares, parsed by `read_applies_to` in `scripts/standards/list.sh`. It reads the backticked paths in the first sentence of the statement, resolves an attribute standard to `*`, and emits an empty array for a statement it cannot read.

The first sentence is the bound rather than the whole statement, since a later sentence names sibling standards and excluded paths that would otherwise land in the same list. Every standard is walked from the flat root. Five return an empty `appliesTo`, not from any exclusion but because their `## Scope` sentence names no backticked path and never says it governs an attribute: they fix a commit message, a branch name, a pull request body, and an issue, none of which is a file in a diff. `glossary.md` is the exception, whose scope sentence names `.canon/teach/<nn>-<topic>/GLOSSARY.md`.

The domain has no write verb. `<name>` prints one standard from `src/commands/standards.ts` and `list` forwards to `scripts/standards/list.sh`, and both read rather than copy. `canon/context/standards/resolution.md` carries the roots each reads.

## Workflow

```bash
canon standards markdown              # prints one standard, frame on stderr
canon standards markdown >house.md    # the document alone, since the frame is separate
canon standards list --json           # the catalog, with appliesTo per standard
```
