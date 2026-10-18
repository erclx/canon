# Tooling nextjs reference

> Extends: `web`. Apply web stack first.

## Overview

The nextjs stack covers Next.js + TypeScript projects using the App Router. It ships golden configs for `next.config.ts`, `vitest.config.ts`, `playwright.config.ts` (build-then-preview), and an `.oxlintrc.json` that replaces the web layer's.

Shared web tooling (oxlint base, screenshot template, VS Code, CI, verify script) comes from the `web` layer.

## Scaffold checklist

1. Scaffold with `bunx create-next-app@latest <name> --typescript --tailwind --no-linter --app --src-dir --import-alias "@/*" --use-bun --skip-install --disable-git --no-agents-md --yes`.
2. Install web tooling with `canon tooling sync web . --write`.
3. Install nextjs configs with `canon tooling sync nextjs . --write`.
4. Extend the `ci` and `development` context entries under `canon/context/` per the web reference's extend sections plus the nextjs rows below.
5. Run `bun run lint:fix`, then `bun run format`, then `bun run check`.

### Scaffold flags

Two flags in step 1 keep the scaffold from writing what the toolkit already owns.

- `--no-agents-md` skips the scaffold-time `AGENTS.md` and `CLAUDE.md` write, which would duplicate the root `CLAUDE.md`.
- `--no-linter` skips the scaffold's `eslint.config.mjs` and `lint` script. It is accepted though `--help` lists only `--eslint` and `--biome`.

## What ships as golden configs

### next.config.ts

Two settings keep Next from fighting the checkout.

- `agentRules: false` stops Next regenerating `AGENTS.md` and `CLAUDE.md` on every run, which would compete with the root `CLAUDE.md`.
- `turbopack.root: import.meta.dirname` pins the workspace root, silencing Next's multi-lockfile inference warning in a checkout with more than one lockfile above the project, a worktree included.

### Test configs

Both test configs differ from the other web stacks.

- `vitest.config.ts` is a plain `defineConfig`, since Next has no Vite config to merge from.
- It sets jsdom, globals, the setup file, `passWithNoTests: true`, v8 coverage, and `.next/**` in test excludes.
- `playwright.config.ts` runs all browsers, with `webServer` running `bun run build && bun run preview` on port `3000` plus `WORKTREE_PORT_OFFSET` and `reuseExistingServer: false`.
- `DIST_PREBUILT` drops the `build` half, matching the astro stack's flag.

### Lint config

`.oxlintrc.json` replaces the web layer's whole file, since oxlint reads one config. It adds `.next` and `next-env.d.ts` to `ignorePatterns`, and turns two rules off for `src/app/**`.

- `react/only-export-components` is `off`, since route and layout files export non-component values the rule would flag.
- `check-file/folder-naming-convention` is `off`, since App Router's bracket, paren, and at-sign folders (dynamic segments, route groups, parallel slots) fail `KEBAB_CASE`.

## Port

Next has no config-file port hook, unlike `server.port` in `astro.config.mjs` or `vite.config.ts`. The `${base} + WORKTREE_PORT_OFFSET` formula is therefore computed twice.

- `playwright.config.ts` computes it as a JS expression.
- `[scripts.override]` computes it as shell arithmetic for `dev` and `preview`, passed to `next`'s own `--port` flag.
- The default port is `3000`, Next's own.

## Typecheck

`typecheck` runs `next typegen && tsc --noEmit`. The App Router's route-level types (`LayoutProps`, `PageProps`) are generated into `.next/types/`, which is gitignored and absent from a fresh checkout. Without the typegen step first, `tsc` fails on them unresolved.

## No golden tsconfig

`create-next-app`'s default `tsconfig.json` needs no changes beyond project-specific path aliases, so a golden copy would ship nothing the scaffold does not already write.

## Development docs (extend)

Append these rows to the `## Scripts` table.

| Command             | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `bun run dev`       | Start the Next dev server on 3000 plus this worktree's offset. |
| `bun run build`     | Build the production bundle.                                   |
| `bun run preview`   | Serve the built bundle on 3000 plus the worktree offset.       |
| `bun run typecheck` | Run `next typegen` then `tsc --noEmit`.                        |

## CI docs (extend)

In `canon/context/development/ci.md`, the Typecheck row asserts `` `next typegen && tsc --noEmit` passes ``. <!-- audit-ignore-citations: canon/context/development/ci.md -->
