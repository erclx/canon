# Tooling vite-react reference

> Extends: `web`. Apply web stack first.

## Overview

The vite-react stack covers Vite + React + TypeScript projects: web apps and Chrome extensions. It ships golden configs for `vite.config.ts`, `vitest.config.ts` (merging from vite config), `playwright.config.ts`, and a unified `tsconfig.json` with `@/` path alias. Shared web tooling (ESLint, screenshot template, VS Code, CI, verify script) comes from the `web` layer.

## Scaffold checklist

1. Scaffold with `bunx create-vite@latest <name> --template react-ts` (web apps) or `bunx create-crxjs@latest` (Chrome extensions).
2. Install base and web tooling: `canon tooling sync web . --write`
3. Install vite-react deps and configs: `canon tooling sync vite-react . --write`
4. Extend the `ci` and `development` context entries under `canon/context/` per the web reference's extend sections plus the vite-react rows below.
5. Run `bun run lint:fix` then `bun run check`.

## What ships as golden configs

- `vite.config.ts`: `@vitejs/plugin-react`, `@tailwindcss/vite`, `@` path alias to `./src`, `VITE_BASE_URL` env for base path. Dev port `5173` and preview port `4173`, each plus `WORKTREE_PORT_OFFSET`, both with `strictPort`.
- `vitest.config.ts`: merges from `vite.config.ts`, jsdom, globals, setup file, `passWithNoTests: true`, v8 coverage.
- `playwright.config.ts`: all browsers, `webServer` on `bun run dev` at port `5173` plus `WORKTREE_PORT_OFFSET`, `reuseExistingServer: false`, trace under `use`.
- `tsconfig.json`: unified, `noEmit: true`, `skipLibCheck: true`, `@/` paths, `vitest/globals` and `@testing-library/jest-dom` in types.

## Chrome extension variant

When scaffolding a Chrome extension, override the installed golden configs:

- `vite.config.ts`: use `crx({ manifest })` and `zip()` from `@crxjs/vite-plugin` instead of `react()` alone. Keep the derived `server.port` and `server.strictPort: true`, set `server.hmr.clientPort` to the same derived value, and add `chrome-extension://` to CORS origins. Drop `VITE_BASE_URL`.
- `vitest.config.ts`: use a standalone `defineConfig` (no `mergeConfig`). crxjs plugin breaks Vitest. Declare `@vitejs/plugin-react` and `@tailwindcss/vite` directly. Add `**/release/**` to excludes and `manifest.config.ts`, `**/*.d.ts` to coverage excludes.
- `playwright.config.ts`: chromium-only (Firefox and WebKit cannot run extensions). Bundled `chromium` channel. No `baseURL` or `webServer`. Tests load the built extension directly from `dist/`.
- `e2e/fixtures.ts`: extend Playwright base `test` with `context` (persistent context loading the extension from `dist/`) and `extensionId` (extracted from service worker URL). Rename `use` to `apply` to avoid the React hooks ESLint rule. `waitForEvent('serviceworker')` blocks until the MV3 service worker registers.
- `manifest.config.ts`: use `defineManifest` from `@crxjs/vite-plugin`. Read `name` and `version` from `package.json`. Entry points `src/popup/index.html`, `src/sidepanel/index.html`, `src/background/index.ts`, `src/content/main.tsx`. Permissions `sidePanel`, `contentSettings`, `storage`. Icon `public/logo.png` at size 48.
- `screenshot` script: `bun run build && bun e2e/screenshot.ts` (no preview server).
- Additional gitignore entries: `*.crx`, `*.pem`, `release/`.

## Setup script

- File: `scripts/setup.sh`. Destructive: deletes `.git` and self-removes after running. Run once immediately after scaffolding.
- Prompt for project name, normalize to kebab-case, derive title-cased display name.
- Update `package.json` name and version, inject verify/clean/update scripts, remove setup.
- Update `<title>` tags in HTML files.
- Wipe `.git`, re-init, make scripts executable, commit as `chore(root): initialize <name>`.

## Development docs (extend)

Append to the `## Scripts` table:

| `bun run dev` | Start the Vite dev server on port 5173, plus this worktree's port offset. |
| `bun run build` | Typecheck then build the production bundle. |
| `bun run preview` | Serve the built bundle locally. |
| `bun run typecheck` | Run `tsc --noEmit`. |

## CI docs (extend)

In `canon/context/ci.md`, the Typecheck row's assertion reads: `` `tsc --noEmit` passes ``. <!-- audit-ignore-citations: canon/context/ci.md -->
