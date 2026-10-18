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

- Author toolkit-internal content under `internal/`, a toolkit-only rule at `internal/rules/`, and a shipped rule at `governance/rules/`.
- Grep the install and list scripts for depth constraints such as `-maxdepth` before restructuring `claude/skills/`, `tooling/`, or `governance/rules/`.
- Bundle the script update with the restructure, or pick a depth the scripts already handle.

## Which copy to edit and cite

- Edit the authoring root, never the consumed copy under `.claude/`. Regenerate that copy with `bun run check`.
- Cite another skill's reference from a body under `claude/` as `${CLAUDE_SKILL_DIR}/../<skill>/references/<name>.md`, never a copy of the file.

## What a shipped body may assume about its checkout

- State the fact behind a reference that resolves only here, since a target holds none of this repository's branches, history, or board.
- Cite a same-repository pull request or commit the way `claude/skills/git-pr/references/publish.md` fixes.
- Cite a docs page through `canon docs <name>`, per `docs/agents/overview.md`, never a raw `docs/<name>.md` or `canon/context/<name>.md` path.
- Exempt a token that only illustrates a path shape.
- Never cite a phase label from a shipped body, nor an installed rule path from a shipped skill body, since a target holds no board and syncs rules separately.
- Mark a deliberate illustration with `<!-- canon-allow-reference: <why> -->`, since `canon gate run` has no skill-level carve-out.
- Never state a count, a stack choice, or a folder shape true of this checkout alone, only a portable convention such as `canon/config/pr-labels.toml`.

## Before shipping

- Load the `internal-shipped-reference` skill before shipping a change under this rule's paths.
- Report it rather than proceeding silently when the skill does not resolve.
- Run `canon gate run` on a change under `claude/`, whose Plugin boundary stage fails a shipped file resolving under `internal/`.
