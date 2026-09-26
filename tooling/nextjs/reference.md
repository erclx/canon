# Tooling nextjs reference

> Extends: `web`. Apply web stack first.

## Overview

The nextjs stack covers Next.js + TypeScript projects using the App Router. It ships golden configs for `next.config.ts`, `vitest.config.ts` (plain `defineConfig`, no bundler merge), `playwright.config.ts` (build-then-preview), and an `eslint.config.js` that extends the web layer's config with `.next` ignores and an App Router override. Shared web tooling (ESLint base, screenshot template, VS Code, CI, verify script) comes from the `web` layer.

## Scaffold checklist

1. Scaffold with `bunx create-next-app@latest <name> --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-bun --skip-install --disable-git --no-agents-md --yes`. `--no-agents-md` skips the scaffold-time `AGENTS.md`/`CLAUDE.md` write, which otherwise duplicates the root `CLAUDE.md`.
2. Install web tooling: `canon tooling sync web . --write`
3. Install nextjs configs: `canon tooling sync nextjs . --write`
4. Extend the `ci` and `development` context entries under `canon/context/` per the web reference's extend sections plus the nextjs rows below.
5. Run `bun run lint:fix` then `bun run check`.

## What ships as golden configs

- `next.config.ts`: `agentRules: false` stops Next from regenerating `AGENTS.md`/`CLAUDE.md` on every run, which would otherwise compete with the root `CLAUDE.md`. `turbopack.root: import.meta.dirname` pins the workspace root, silencing Next's multi-lockfile inference warning in any checkout carrying more than one lockfile above the project, a worktree included.
- `vitest.config.ts`: plain `defineConfig`, no `mergeConfig` or `getViteConfig` since Next has no Vite config to merge from. jsdom, globals, setup file, `passWithNoTests: true`, v8 coverage, `.next/**` in test excludes.
- `playwright.config.ts`: all browsers, `webServer` runs `bun run build && bun run preview` on port `3000` plus `WORKTREE_PORT_OFFSET`, `reuseExistingServer: false`. `DIST_PREBUILT` drops the `build` half, matching the astro stack's flag.
- `eslint.config.js`: overrides the web layer with `.next` and `next-env.d.ts` added to `globalIgnores`, keeping `react-hooks`/`react-refresh` since this stack still ships React components. `react-refresh/only-export-components` is `off` for `src/app/**`, since route and layout files export non-component values the rule would otherwise flag. `check-file/folder-naming-convention` is `off` for the same subtree, since App Router's bracket, paren, and at-sign folder syntax (dynamic segments, route groups, parallel slots) fails `KEBAB_CASE`.

## Port

Next has no config-file port hook, unlike `astro.config.mjs`'s `server.port` or `vite.config.ts`'s `server.port`. The `${base} + WORKTREE_PORT_OFFSET` formula is computed twice instead of once: in `playwright.config.ts` as a JS expression, and in `[scripts.override]` for `dev` and `preview` as shell arithmetic passed to `next`'s own `--port` flag. Default port is `3000`, Next's own default.

## Typecheck

`typecheck` runs `next typegen && tsc --noEmit`. The App Router's route-level types (`LayoutProps`, `PageProps`) are generated into `.next/types/`, gitignored and absent from a fresh checkout, and `tsc` fails on them unresolved without the typegen step first.

## No golden `tsconfig.json`

`create-next-app`'s own default `tsconfig.json` needs no changes beyond project-specific path aliases, so a golden copy here would ship nothing the scaffold does not already write.

## Gitignore (extend)

`[gitignore]` groups this stack edits, restated here per the manifest-to-reference symmetry:

- `"# Next" = [".next/"]`

## Development docs (extend)

Append to the `## Scripts` table:

| `bun run dev` | Start the Next dev server on port 3000, plus this worktree's port offset. |
| `bun run build` | Build the production bundle. |
| `bun run preview` | Serve the built bundle locally, on port 3000 plus the worktree offset. |
| `bun run typecheck` | Run `next typegen` then `tsc --noEmit`. |

## CI docs (extend)

In `canon/context/ci.md`, the Typecheck row's assertion reads: `` `next typegen && tsc --noEmit` passes ``. <!-- audit-ignore-citations: canon/context/ci.md -->
