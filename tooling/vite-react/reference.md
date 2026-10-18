# Tooling vite-react reference

> Extends: `web`. Apply web stack first.

## Overview

The vite-react stack covers Vite + React + TypeScript web apps and Chrome extensions. It ships golden configs for `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, and a unified `tsconfig.json` with an `@/` path alias. Shared web tooling (oxlint, screenshot template, VS Code, CI, verify script) comes from the `web` layer.

## Scaffold checklist

1. Scaffold with `bunx create-vite@latest <name> --template react-ts` (web apps) or `bunx create-crxjs@latest` (Chrome extensions).
2. Install base and web tooling with `canon tooling sync web . --write`.
3. Install vite-react deps and configs with `canon tooling sync vite-react . --write`.
4. Extend the `ci` and `development` context entries under `canon/context/` per the web reference's extend sections plus the vite-react rows below.
5. Run `bun run lint:fix`, then `bun run format`, then `bun run check`.

## What ships as golden configs

- `vite.config.ts` adds `@vitejs/plugin-react`, `@tailwindcss/vite`, the `@` alias to `./src`, and `VITE_BASE_URL` for the base path.
- It serves dev on port `5173` and preview on `4173`, each plus `WORKTREE_PORT_OFFSET`, both with `strictPort`.
- `vitest.config.ts` merges from `vite.config.ts`, imported with its `.ts` extension, which Vite 8 requires. It sets jsdom, globals, the setup file, `passWithNoTests: true`, and v8 coverage.
- `playwright.config.ts` runs all browsers, with `webServer` on `bun run dev` at port `5173` plus `WORKTREE_PORT_OFFSET`, `reuseExistingServer: false`, and trace under `use`.
- `tsconfig.json` is unified, with `noEmit: true`, `skipLibCheck: true`, `@/` paths, and `vitest/globals` and `@testing-library/jest-dom/vitest` in types.

## Chrome extension variant

When scaffolding a Chrome extension, override the installed golden configs.

### Build config

The crxjs plugin replaces the plain React build.

- `vite.config.ts` uses `crx({ manifest })` and `zip()` from `@crxjs/vite-plugin` instead of `react()` alone. Drop `VITE_BASE_URL`.
- Keep the derived `server.port` and `server.strictPort: true`, set `server.hmr.clientPort` to the same derived value, and add `chrome-extension://` to CORS origins.

### Test configs

The plugin also changes how Vitest and Playwright run.

- `vitest.config.ts` uses a standalone `defineConfig` with no `mergeConfig`, since the crxjs plugin breaks Vitest. Declare `@vitejs/plugin-react` and `@tailwindcss/vite` directly.
- It also adds `**/release/**` to excludes, and `manifest.config.ts` and `**/*.d.ts` to coverage excludes.
- `playwright.config.ts` is chromium-only, since Firefox and WebKit cannot run extensions.
- It uses the bundled `chromium` channel with no `baseURL` or `webServer`, and tests load the built extension from `dist/`.

### Fixtures and manifest

The extension needs a fixture file and a manifest config.

- `e2e/fixtures.ts` extends Playwright's base `test` with `context`, a persistent context loading the extension from `dist/`, and `extensionId`, extracted from the service worker URL.
- Rename `use` to `apply` in that file to avoid oxlint's `react/rules-of-hooks`. `waitForEvent('serviceworker')` blocks until the MV3 service worker registers.
- `manifest.config.ts` uses `defineManifest` from `@crxjs/vite-plugin` and reads `name` and `version` from `package.json`.
- Its entry points are `src/popup/index.html`, `src/sidepanel/index.html`, `src/background/index.ts`, and `src/content/main.tsx`.
- Its permissions are `sidePanel`, `contentSettings`, and `storage`, with icon `public/logo.png` at size 48.

### Scripts and ignores

The extension build changes one script and adds ignores.

- The `screenshot` script is `bun run build && bun e2e/screenshot.ts`, with no preview server.
- Add `*.crx`, `*.pem`, and `release/` to gitignore.

## Development docs (extend)

Append these rows to the `## Scripts` table.

| Command             | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `bun run dev`       | Start the Vite dev server on 5173 plus this worktree's offset. |
| `bun run build`     | Typecheck then build the production bundle.                    |
| `bun run preview`   | Serve the built bundle locally.                                |
| `bun run typecheck` | Run `tsc --noEmit`.                                            |

## CI docs (extend)

In `canon/context/development/ci.md`, the Typecheck row asserts `` `tsc --noEmit` passes ``. <!-- audit-ignore-citations: canon/context/development/ci.md -->
