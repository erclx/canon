---
description: Enforce where toolkit content is authored and which copy a rule, skill, or seed cites
paths:
  - 'internal/**'
  - 'claude/**'
  - 'governance/**'
  - 'docs/**'
  - 'scripts/**'
  - 'tooling/**'
---

# Authoring layout standards

## Where to author

- Author toolkit-internal content under `internal/`, never inside an installable surface.
- Author a toolkit-only rule at `internal/rules/` and a rule that ships to targets at `governance/rules/`.
- Before restructuring installable content under `claude/skills/`, `tooling/`, or `governance/rules/`, grep the matching install and list scripts for depth constraints such as `-maxdepth` and fixed globs. Bundle the script update with the restructure, or pick a depth the scripts already handle.

## Which copy to edit and cite

- Edit the authoring root, never the consumed copy under `.claude/`. Regenerate that copy with `bun run check`.
- Cite a reference another skill owns as `${CLAUDE_SKILL_DIR}/../<skill>/references/<name>.md` from a body under `claude/`, naming the owner skill rather than copying the file. The plugin ships the skills side by side, so the sibling path resolves in every plugin cache.

## What a shipped body may assume about its checkout

- A shipped body runs in a target holding none of this repository's branches, history, or gitignored board. State the fact behind a reference wherever the reference only resolves here.
- Cite a same-repository pull request or commit the way `claude/skills/git-pr/references/publish.md` fixes, which owns the same-repository rule. This file fixes citation mechanics rather than restating it.
- Cite a docs page through `canon docs <name>`, resolved per `docs/agents/overview.md`'s three-spelling rule. Never write a raw `docs/<name>.md` or `canon/context/<name>.md` path that names this repository's own reference corpus. The second has no resolving form at all for a registry install, since `canon/` is never published. This rule governs a reference to a real page, never a token shown to illustrate the path shape a target's own tree would take, which is what lets a body teaching the convention still show what one looks like.
- Never cite a phase label from a shipped body, nor an installed rule path, such as `.claude/rules/canon/canon/scratch.md`, from a shipped skill body. State the fact it points at instead, since a target holds no board and receives a rule only through a separate `canon gov sync`. The shipped-references stage of `canon gate run` fails both, and a deliberate illustration takes `<!-- canon-allow-reference: <why> -->`, including a skill whose subject is the rules corpus, since the gate carries no skill-level carve-out.
- Write a layout, stack, or config-path claim only where it names a portable convention true of any project carrying the same toolkit surface, such as a fixed install path like `canon/config/pr-labels.toml`. Never state a count, a stack choice, or a folder shape true of this checkout specifically.
- Load the `internal-shipped-reference` skill before shipping a change under any of this rule's paths. It reviews the one form the bullets above cannot classify by pattern alone: a `canon/context/<name>.md` reference that resolves here and reads as portable, and a layout or count claim stated as portable when it holds only for this checkout.
- Report it rather than proceeding silently when the skill does not resolve.

## Before shipping

- Run `canon gate run` on a change under `claude/`. Its Plugin boundary stage always runs and fails on any shipped file resolving under `internal/`.
