---
description: Enforce where toolkit content is authored and which copy a rule, skill, or seed cites
paths:
  - 'internal/**'
  - 'standards/**'
  - 'snippets/**'
  - 'claude/**'
  - 'governance/**'
  - 'docs/**'
  - 'scripts/**'
  - 'tooling/**'
---

# Authoring layout standards

## Where to author

- Author toolkit-internal content under `internal/`, never inside an installable surface.
- Author standards at `standards/` and snippets at `snippets/`, both at the project root.
- Author a toolkit-only rule at `internal/rules/` and a rule that ships to targets at `governance/rules/`.

## Which copy to edit and cite

- Edit the authoring root, never the consumed copy under `.claude/`. Regenerate that copy with `bun run check`.
- Cite a standard in the form its carrier resolves. The corpus has no consumed copy, so no single spelling answers on every surface.
- Cite `${CLAUDE_SKILL_DIR}/../../standards/<name>.md` from a body under `claude/`, which resolves off the `claude/standards` symlink in every plugin cache.
- Call `canon standards <name>` from a rule or a seed. Both are read with no skill context, so `${CLAUDE_SKILL_DIR}` expands to nothing there.
- Cite `standards/<name>.md` from a file that stays in this repository, which is the working root the resolver reads first.

## What a shipped body may assume about its checkout

- A shipped body runs in a target holding none of this repository's branches, history, or gitignored board. State the fact behind a reference wherever the reference only resolves here.
- Cite a same-repository pull request or commit the way `standards/publish.md` fixes, which owns the same-repository rule. This file fixes citation mechanics rather than restating it.
- Cite a docs page through `canon docs <name>`, resolved per `docs/agents/docs.md`'s three-spelling rule. Never write a raw `docs/<name>.md` or `.claude/context/<name>.md` path that names this repository's own reference corpus. The second has no resolving form at all for a registry install, since `.claude/` is never published. This rule governs a reference to a real page, never a token shown to illustrate the path shape a target's own tree would take, which is what lets a body teaching the convention still show what one looks like.
- Never cite a phase label. A target holds no board to resolve it against, so state the fact the label points at instead of the label itself. This rule governs a reference to a real row, never a token shown to illustrate the label's own format.
- Write a layout, stack, or config-path claim only where it names a portable convention true of any project carrying the same toolkit surface, such as a fixed install path like `.claude/canon/pr-labels.toml`. Never state a count, a stack choice, or a folder shape true of this checkout specifically.
- Load the `internal-shipped-reference` skill before shipping a change under any of this rule's paths. It reviews the one form the bullets above cannot classify by pattern alone: a `.claude/context/<name>.md` reference that resolves here and reads as portable, and a layout or count claim stated as portable when it holds only for this checkout.
- Report it rather than proceeding silently when the skill does not resolve.

## Before shipping

- Run `scripts/core/check-plugin-boundary.sh` on a change under `claude/`. It fails on any shipped file resolving under `internal/`.
