---
title: Tooling stack reference
description: Shape and content rules for tooling stack reference docs, and the manifest symmetry the reference owes
---

# Tooling stack reference

## Overview

A stack reference records the explicit decisions a tooling stack makes, so a reader knows what the stack chose without opening every config. It lives at `tooling/<stack>/reference.md` and reads through `canon tooling reference <stack>`, resolving the working root first and the packaged corpus after. Nothing installs it into a target and nothing generates it, so it is written by hand and kept current by hand.

## The manifest pair

The reference and `tooling/<stack>/manifest.toml` are one decision recorded twice, and nothing compares them. A manifest edited alone leaves the reference stating the old set and an agent following the reference gets the stale answer.

The symmetry runs in both directions, and the direction that breaks is the manifest moving first. A reader arrives here because they touched one of the two files, not because they set out to keep the pair aligned.

- Edit both files in the same change. Neither one is the source the other derives from.
- Restate every `[gitignore]` group verbatim. This is the group that has drifted, because a group reads as a config detail rather than as a documented decision.
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

```markdown
# Tooling vite-react reference

> Extends: `base`. Apply base stack first.

## Overview

The vite-react stack covers Vite, React, and TypeScript projects, including web apps and Chrome extensions.

## Prettier (extend)

- Add `jsxSingleQuote: true`.
- Add `prettier-plugin-tailwindcss` to the plugins array.

## Vitest

- Environment: `jsdom`.
- Globals: `true`.
- Setup file: `src/test/setup.ts`. Imports `@testing-library/jest-dom` and runs `cleanup` after each test.
```
