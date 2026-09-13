---
title: Snippets
description: Reusable prompt snippets for Claude Code and chat UIs
---

# Snippets system

## Overview

Owns the small reusable prompts stored as plain markdown, invoked directly in Claude Code with `@` or in a chat UI through the Chrome extension. Authoring conventions live in `standards/snippets.md`, which this entry does not repeat.

## Layout

- `snippets/` owns the authoring source, with base snippets at the root
- `snippets/<category>/` owns one category, preserved as a folder on install
- `internal/snippets/` owns the snippets only this repository can run, outside anything the plugin ships

## Decisions

- Folder structure was preserved on install, so `claude/figma-steps.md` installed as `.claude/snippets/claude/figma-steps.md` and was invoked as `@.claude/snippets/claude/figma-steps`. A target now carries no such copy: `claude/snippets` is a symlink to this folder, the same live-resolve mechanism `claude/standards` uses, so a plugin session reaches a snippet at `@claude/snippets/claude/figma-steps` with no install step in between.
- The root is the authoring source. A target's `.claude/snippets/` is a stale copy from before `canon snippets install` retired rather than anything a current toolkit writes, matching the `standards/` split.
- `canon snippets install` and `canon snippets sync` are retired, the same ground `canon/ARCHITECTURE.md` retired `canon standards install` on: a copied corpus drifted with nothing able to refresh it, and the live symlink now serves every plugin cache instead. `src/snippets/install.ts` and `src/snippets/adapter.ts` are gone with their subcommands, and `canon init` carries no `--snippets` flag or install step.
- Presets are virtual curated subsets defined in `snippets.toml`, while categories are auto-derived from folders. Adding a folder adds a category with no registration step. Both still resolve through `canon snippets create`, the one command left that writes into a folder.
- Every folder under `snippets/` is publishable, so nothing filters. The ones no entry point reads live in `internal/snippets/`.
- The retrieval half of the retirement is the cost the delivery half does not carry. A standard is read by `canon standards <name>`, which resolves against the package from anywhere, so closing its install cost a reader nothing. A snippet is reached by a path a person types after `@`, and a plugin cache path can be typed but not discovered, so a target that stops holding `.claude/snippets/` may leave its snippets reachable in principle and unreachable in practice. `canon snippets list` is the catalog a reader without a memorized path falls back to.
- `governance/rules/snippets/600-at-references.md`, the `@`-reference convention rule, used to install only through `installSnippetsRule` inside the now-retired `canon snippets install`. Losing that channel left the rule no delivery path at all, so `base` now carries `snippets` as a folder-whole entry (see `canon/context/governance/rules.md`), reaching every base consumer through `canon gov install`/`sync` instead.
- `migration-standards`, the skill that proposed moving a root `snippets/` folder into `.claude/snippets/`, is retired with the install channel it existed to backfill. `.claude/snippets/` is no longer a legitimate destination for anything a person authors, and nothing generates into it either, which leaves it in the same position as `standards/`.

### Where a snippet lives

- Who invokes a snippet decides where it lives, not what its topic is about. Filing a category by subject once put the orchestrator runbooks out of reach of the target projects running that role, and nothing failed, because a snippet the plugin does not ship produces no error anywhere.
- Those three have since left the catalog altogether, per the runbook decision below. `standards/snippets.md` states the cadence and audience tests, and this repository holds the only copy of how they map onto folders.
- The root and `claude/` split is that audience test at one more level of resolution. `snippets/` holds what carries its whole context in the message and runs in any chat, `snippets/claude/` what reads or writes the project's own files, and `internal/snippets/` what only this repository can run.
- A snippet naming a `.claude/` path belongs in a folder rather than at the root, which is the checkable form of the rule
- The cadence test turns down a one-shot audit, migration, or bootstrap prompt and says nothing about a prompt's subject. A prompt about authoring prompts still passes when it recurs across sessions, which is what keeps `meta-prompt` and `research-prompt` in the catalog. Reading "project work" into the rule adds a second test the standard does not state.

### What earns a place

- A snippet overlapping a shipped skill keeps its place when the two are reached differently and produce different things:
  - `claude/feature-recap` emits a verification block to chat and writes nothing, where `docs-fold` mutates tracked planning docs
  - `claude/decision-memo` answers a should-we question, where `plan-feature` plans a build
  - `session-notes` emits a paste-anywhere block usable in a chat with no repository behind it
- An overlap without such a reason loses to the skill, which is what retired the `create-snippet` snippet against the skill of the same name
- A runbook one skill fires and nothing else reads belongs in that skill's `references/`, not in this catalog. The three orchestrator runbooks moved to `claude/skills/role-orchestrator/references/` and the `orchestrator` preset retired with them, leaving `essentials` as the only preset.
- The two channels are what forced it: a skill loads live from the plugin root while a snippet is copied by a CLI command, so a skill citing an installed path breaks for a project that added the plugin and ran no install, and nothing reports it. A reference travels with the body that cites it, so long as that body is the only reader.
- What the move costs is the typed entry point, since a person fires a snippet by path and cannot type a reference, so the skill body routes a request for either compaction side to the runbook that serves it. An invocation word was the first attempt and `standards/skill.md` bans it, because a flag selecting an alternate flow is the shape the model misreads on its way to the vanilla path.

### The boundary

No code filters an internal category out of a publishable one. The plugin symlinks `snippets/` wholesale and a session reading through it resolves the symlink, so the one consumer that could carry no filter is the one that ships the content, and a filter at any other entry point only looks like a boundary. Location is what enforces it, and `scripts/core/check-plugin-boundary.sh` asserts the result.

## Gotchas

- A target's `.claude/snippets/` predates this retirement if it exists at all. Nothing writes it now, nothing reads it in preference to the live symlink, and nothing reconciles it against the source. Treat it as a stale copy rather than as the current install surface.
- The three orchestrator runbooks are the live instance, so a project that installed the `orchestrator` preset in the window it existed still holds all three under `.claude/snippets/claude/` and can delete them once the skill carries the same text
- The toolkit feedback flow is the `canon-feedback-file` plugin skill plus the `canon feedback` CLI, not a snippet.
- The memory review phases (challenge, discuss, apply, cleanup) live in the `memory-review` skill body rather than in snippets of their own. Re-ping the skill with the matching phase phrase.

Counting what depends on a prose contract means scanning `snippets/` alongside `claude/skills/`, since a snippet carries a procedure that reads the same strings a skill does and is invisible to a skills-only grep. The plan for the board-heading contract recorded one consumer of `## Run now` and named the second, `snippets/claude/orchestrator-resume.md`, nowhere. Had the fix moved the dependency out of `role-orchestrator` rather than into `standards/tasks.md`, the snippet would have been left reading a string no standard fixed. Grep `claude/`, `snippets/`, `governance/`, `standards/`, and `internal/` in one pass and account for every hit, including the ones that turn out to be labels rather than reads. An undercount is the dangerous direction, because it is the count a Files-to-touch list is scoped from.

## Presets and categories

Presets are virtual curated subsets defined in `snippets.toml`. Categories are auto-derived from folders. Run `canon snippets list` for the catalog of both, and `--entries` for the slugs in each. Neither resolves against an install argument any more, since nothing installs. Both exist now to help a reader find the `@`-reference path a snippet resolves at.

## CLI

| Command                 | Description                                              |
| ----------------------- | -------------------------------------------------------- |
| `canon snippets create` | Create a new snippet file in the correct category folder |
| `canon snippets list`   | Emit catalog of presets, categories, and entries         |

Flags and arguments live in `docs/agents/index.md`. `canon snippets` with no args prints help, since each verb is registered by name rather than routed through a dispatcher.

`list` is TypeScript. `create` is registered by name and forwards to `scripts/snippets/create.sh`, keeping its own `--help`.

## Workflow

```bash
canon snippets list                # catalog of presets, categories, and entries
```

To create a new snippet:

```bash
canon snippets create
# prompts for category (existing folder, new folder, or base root)
# confirms the derived slug before writing
# creates snippets/{category}/{name}.md or snippets/{name}.md for base
```

## Adding a snippet

Use `canon snippets create`. It handles file and folder creation. For manual additions, create a `.md` file in the correct folder using a kebab-case name.

The `create-snippet` skill writes one snippet, resolving the surface at either location: `snippets/` at the root when present, the toolkit repo, otherwise `.claude/snippets/`, a target project that still holds one from before the install channel retired. On the project surface it writes one level deeper, under `.claude/snippets/project/`, a convention now kept for its own sake rather than for a sync that no longer runs. It reaches the authoring conventions through `standards/snippets.md`, cited at `${CLAUDE_SKILL_DIR}/../../standards/snippets.md`, the same fallback form every skill uses to reach a flat-root standard.

## Adding a category

Use `canon snippets create` and select `new category` when prompted. To add manually, create a new subfolder under `snippets/` with a kebab-case name and put snippet files inside it.

## Adding a preset

Edit `snippets/snippets.toml`. Append a section with a kebab-case name and a `names` array of slugs. Slugs may include a folder prefix (`claude/feature-recap`).

```toml
[my-preset]
names = [
    "decision-help",
    "claude/feature-recap",
]
```
