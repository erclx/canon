---
title: Snippets
description: Reusable prompt snippets for Claude Code and chat UIs, where a snippet lives, what earns a place against a skill, the boundary, and adding a snippet, category, or preset
---

# Snippets system

## Overview

Owns the small reusable prompts stored as plain markdown, invoked directly in Claude Code with `@` or in a chat UI through the Chrome extension. Authoring conventions live in `standards/snippets.md`, which this entry does not repeat.

## Layout

- `snippets/` owns the authoring source, with base snippets at the root
- `snippets/<category>/` owns one category
- `internal/snippets/` owns the snippets only this repository can run, outside anything the plugin ships

## Decisions

- `claude/snippets` is a symlink to this folder, the same live-resolve mechanism `claude/standards` uses, so a plugin session reaches a snippet at `@claude/snippets/claude/figma-steps` with no install step in between.
- Snippets carry no install or sync verb, on the same ground `canon/context/standards/resolution.md` records for standards: a copied corpus drifts with nothing able to refresh it, and the live symlink serves every plugin cache. `canon init` carries no snippets flag or step.
- The retrieval half is the cost that choice carries. A standard is read by `canon standards <name>`, which resolves against the package from anywhere. A snippet is reached by a path a person types after `@`, and a plugin cache path can be typed but not discovered, so `canon snippets list` is the catalog a reader without a memorized path falls back to.
- Presets are virtual curated subsets defined in `snippets.toml`, while categories are auto-derived from folders. Adding a folder adds a category with no registration step. Neither resolves against an install argument, and both exist to help a reader find the `@` path a snippet resolves at.
- Every folder under `snippets/` is publishable, so nothing filters. The ones no entry point reads live in `internal/snippets/`.
- `governance/rules/snippets/600-at-references.md`, the `@`-reference convention rule, reaches every base consumer through `canon gov install` and `sync`, since `base` carries `snippets` as a folder-whole entry, per `canon/context/governance/rules.md`.

### Where a snippet lives

- Who invokes a snippet decides where it lives, not its topic. A category filed by subject can place a snippet out of reach of the project meant to run it, with no error, since a snippet the plugin does not ship fails nowhere. `standards/snippets.md` states the cadence and audience tests, and this repository holds the only copy of how they map onto folders.
- The root and `claude/` split is that audience test at one more level of resolution. `snippets/` holds what carries its whole context in the message and runs in any chat, `snippets/claude/` what reads or writes the project's own files, and `internal/snippets/` what only this repository can run.
- A snippet naming a `.claude/` path belongs in a folder rather than at the root, which is the checkable form of the rule
- The cadence test turns down a one-shot audit, migration, or bootstrap prompt and says nothing about a prompt's subject. A prompt about authoring prompts still passes when it recurs across sessions, which is what keeps `meta-prompt` and `research-prompt` in the catalog. Reading "project work" into the rule adds a second test the standard does not state.

### What earns a place

- A snippet overlapping a shipped skill keeps its place when the two are reached differently and produce different things:
  - `claude/feature-recap` emits a verification block to chat and writes nothing, where `docs-fold` mutates tracked planning docs
  - `claude/decision-memo` answers a should-we question, where `plan-feature` plans a build
  - `session-notes` emits a paste-anywhere block usable in a chat with no repository behind it
- An overlap without such a reason loses to the skill, which is why no `create-snippet` snippet exists beside the skill of that name.
- A runbook one skill fires and nothing else reads belongs in that skill's `references/`, not in this catalog. The three orchestrator runbooks sit at `claude/skills/role-orchestrator/references/`, and `essentials` is the only preset.
- The two channels are what force it: a skill loads live from the plugin root, so a skill citing a path outside its own tree breaks for a project that added the plugin alone, and nothing reports it. A reference travels with the body that cites it, so long as that body is the only reader.
- What placing it there costs is the typed entry point, since a person fires a snippet by path and cannot type a reference, so the skill body routes a request for either compaction side to the runbook that serves it. An invocation word is the rejected alternative, since `standards/skill.md` bans it: a flag selecting an alternate flow is the shape the model misreads on its way to the vanilla path.

### The boundary

No code filters an internal category out of a publishable one. The plugin symlinks `snippets/` wholesale and a session reading through it resolves the symlink, so the one consumer that could carry no filter is the one that ships the content, and a filter at any other entry point only looks like a boundary. Location is what enforces it, and `scripts/core/check-plugin-boundary.sh` asserts the result.

## Gotchas

- A target's `.claude/snippets/`, if it exists, is a stale copy from an earlier install channel. Nothing writes it, nothing reads it in preference to the live symlink, and nothing reconciles it against the source. A project holding the orchestrator runbooks under `.claude/snippets/claude/` can delete them, since the skill carries the same text.
- `.claude/snippets/` is no legitimate destination for anything a person authors, and nothing generates into it, which leaves it in the same position as `standards/`.
- The toolkit feedback flow is the `canon-feedback` plugin skill plus the `canon feedback` CLI, not a snippet.
- The memory review phases, being challenge, discuss, apply, and cleanup, live in the `memory-review` skill body rather than in snippets of their own. Re-ping the skill with the matching phase phrase.
- Counting what depends on a prose contract means scanning `snippets/` alongside `claude/skills/`, since a snippet can carry a procedure that reads the same string a skill does and is invisible to a skills-only grep. Grep `claude/`, `snippets/`, `governance/`, `standards/`, and `internal/` in one pass and account for every hit, including the ones that turn out to be labels rather than reads. An undercount is the dangerous direction, because it is the count a Files-to-touch list is scoped from.

## Workflow

`canon snippets list` emits the catalog of presets, categories, and entries, and `canon snippets create` writes a new snippet into the right folder. `create` forwards to `scripts/snippets/create.sh`, which prompts for the category and confirms the derived slug. Flags live in `docs/agents/index.md`.

- A snippet: run `canon snippets create`, or create a kebab-case `.md` file in the correct folder by hand. The `create-snippet` skill writes one snippet at `snippets/` when that root exists, or under `.claude/snippets/project/` in a target that still holds one, keeping the two surfaces distinguishable. It reaches `standards/snippets.md` at `${CLAUDE_SKILL_DIR}/../../standards/snippets.md`, the form every skill uses for a flat-root standard.
- A category: select `new category` in `canon snippets create`, or create a kebab-case subfolder under `snippets/` and put snippet files inside it.
- A preset: append a kebab-case section to `snippets/snippets.toml` with a `names` array of slugs, which may carry a folder prefix.

```toml
[my-preset]
names = [
    "decision-help",
    "claude/feature-recap",
]
```
