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
- Grep the code for a depth limit, such as `-maxdepth` or a `*/` glob, before restructuring `claude/skills/`, `tooling/`, or `governance/rules/`.
- Update that code in the restructure, or pick a depth it already handles.

## Which copy to edit and cite

- Edit the authoring root, never the consumed copy under `.claude/`, which `bun run check` regenerates.
- Cite another skill's reference from a body under `claude/` as `${CLAUDE_SKILL_DIR}/../<skill>/references/<name>.md`, never a copy.

## What a shipped body may assume about its checkout

- State the fact behind a reference resolving only here, since a target holds none of this repository's branches, history, or board.
- Cite a same-repository pull request or commit the way `claude/skills/git-pr/references/publish.md` fixes.
- Cite a docs page through `canon docs <name>`, per `docs/agents/overview.md`, never a `docs/<name>.md` or `canon/context/<name>.md` path.
- Never cite a phase label from a shipped body, nor an installed rule or `tooling/<stack>/{configs,seeds}/` from a shipped skill body, since a target holds no board or `tooling/` and syncs rules apart.
- Exempt a token only illustrating a path shape, marking one the gate reports with `<!-- canon-allow-reference: <why> -->`.
- Never state a count, stack choice, or folder shape true of this checkout alone, only a portable convention such as `canon/config/pr-labels.toml`.
- Keep a `claude/skills/` line only this toolkit acts on, conditional or not, to the toolkit-facing skills `internal-shipped-reference` lists.

## Before shipping

- Load the `internal-shipped-reference` skill before shipping under this rule's paths.
- Report it rather than proceeding silently when the skill does not resolve.
- Run `canon gate run` on a change under `claude/`, whose Plugin boundary stage fails a shipped file resolving under `internal/`.
