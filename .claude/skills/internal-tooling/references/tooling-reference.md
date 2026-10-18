---
title: Tooling stack reference
description: Shape and content rules for tooling stack reference docs, and the manifest symmetry the reference owes
---

# Tooling stack reference

## Overview

A stack reference records the explicit decisions a tooling stack makes, so a reader knows what the stack chose without opening every config. It lives at `tooling/<stack>/reference.md` and reads through `canon tooling reference <stack>`, resolving the working root first and the packaged corpus after.

- Write for a session working in a project that installed the stack, since that session is the one the verb serves
- Keep guidance for authoring or maintaining the stack in the `internal-tooling` skill. A target session cannot act on it.
- Nothing installs the reference and nothing generates it, so it is written and kept current by hand

### What the verb prints after it

The verb appends two sections from the stack's manifest and folders, so no reference writes either one. A hand list drifts from the files it names.

- `## Sync` lists the files sync keeps current, from `configs/`, and the files it copies once, from `seeds/`
- `## Gitignore` lists the manifest's `[gitignore]` groups
- Each lists the stack's own entries alone, and a section with nothing to list prints no heading

## The manifest pair

The reference and `tooling/<stack>/manifest.toml` are one decision recorded twice, and nothing compares them. A manifest edited alone leaves the reference stating the old set and an agent following the reference gets the stale answer.

The symmetry runs in both directions, and the direction that breaks is the manifest moving first. A reader arrives here because they touched one of the two files, not because they set out to keep the pair aligned.

- Edit both files in the same change. Neither one is the source the other derives from.
- Leave `[gitignore]` groups and the shipped file list out of the reference, since the verb prints both from the manifest and the folders. Record a group's reason only when it is non-obvious.
- Record a `[scripts]` key in the `## CLI` table when the stack introduces a command.
- Document the manual install step when `runtime` is not `bun`, since injection runs `bun add -D` and such a manifest leaves `[dependencies.dev]` empty.

## Content

- Capture decisions, not descriptions. Write `Use semi: false`, not `Prettier is configured with semi set to false`.
- Omit anything that is a tool default. Document explicit choices only.
- Omit a section entirely when its config is empty or carries only defaults.
- Never include full file contents, code blocks, or script bodies. The config is the source, the reference is the rationale.
- Skip rationale unless a decision is non-obvious. One inline note is the cap in that case.

## Structure

- Open with `## Overview`, one or two sentences covering what the stack provides and when to use it.
- Follow with one section per tool.
- Group by tool or concern, never by file. A reader looks for Prettier, not for `.prettierrc`.
- Match section headings to tool names (`## Prettier`, `## ESLint`, `## TypeScript`).
- Close with a `## CLI` table only when the stack introduces commands. Omit the section otherwise.

## Extends chain

- When the stack extends another, open with `> Extends: <parent>. Apply <parent> stack first.` and document deltas only.
- When a config file extends another within the same stack, capture only what the file itself adds. Do not re-document the parent.
- Mark a section that layers onto a parent's tool with `(extend)` in the heading.

## Rules

- Write one rule per bullet, atomic and imperative.
- Use imperative voice. Write `Use X`, `Add Y`, `Set Z`, never `You should` or `Consider`.
- Do not write prose paragraphs between sections.

## Example

An excerpt from the current `vite-react` reference, which the verb follows with its printed `## Sync`.

```markdown
# Tooling vite-react reference

> Extends: `web`. Apply web stack first.

## Overview

The vite-react stack covers Vite + React + TypeScript web apps and Chrome extensions.

## What ships as golden configs

- `vite.config.ts` adds `@vitejs/plugin-react`, `@tailwindcss/vite`, and the `@` alias to `./src`.
- It serves dev on port `5173` and preview on `4173`, each plus `WORKTREE_PORT_OFFSET`, both with `strictPort`.
```

### Before and after

Each pair is taken from a reference that broke the standard and the shape it was rewritten to.

| Before                                                              | After                                                          |
| ------------------------------------------------------------------- | -------------------------------------------------------------- |
| `claude` drew its seeded files as a tree inside a `plaintext` fence | Nothing, since the verb prints `## Sync` from `seeds/`         |
| `web` carried "What stays in per-stack adapters" for stack authors  | The same guidance under `## Web stack authoring` in this skill |
| `Prettier is configured with semi set to false`                     | `Use semi: false`                                              |
