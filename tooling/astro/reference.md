# Tooling Astro reference

> Extends: `web`. Apply web stack first.

## Overview

The astro stack covers Astro + TypeScript projects: content sites, marketing sites, blogs, and docs. Interactive islands use React only. Output is static. It ships golden configs for `astro.config.mjs`, `vitest.config.ts` (using `getViteConfig` from `astro/config`), `playwright.config.ts` (preview-server backed), a `tsconfig.json` that extends `astro/tsconfigs/strict`, and an `eslint.config.js` that overrides the web layer's config to include `eslint-plugin-astro` and exclude React-refresh rules.

## Scaffold checklist

1. Scaffold with `bunx create-astro@latest`. Choose `TypeScript: Strict`. Skip git init and install.
2. Add React integration: `bunx astro add react`. Do not use `astro add tailwind`. That command installs the v3 integration. Tailwind v4 arrives via the web manifest.
3. Install web tooling: `canon tooling sync web . --write`
4. Install astro adapter: `canon tooling sync astro . --write`
5. Extend the `ci` and `development` context entries under `canon/context/` per the web reference's extend sections plus the astro rows below.
6. Run `bun run lint:fix` then `bun run check`.

## What ships as golden configs

- `astro.config.mjs`: `@astrojs/react` integration, `@tailwindcss/vite` in `vite.plugins`, `@/` path alias via `vite.resolve.alias`, `ASTRO_SITE` env for the `site` field. Port `4321` plus `WORKTREE_PORT_OFFSET` at `server.port`, with `strictPort` under `vite.server` and `vite.preview`. Astro merges the user's `vite` block into the config backing both its dev and its static preview server, and feeds `server.port` through as the preview port, so the port sits at the top level while the bind guarantee sits under `vite`.
- `vitest.config.ts`: uses `getViteConfig` from `astro/config` (not `mergeConfig`). jsdom, globals, setup file, `passWithNoTests: true`, v8 coverage, `**/*.astro` in coverage excludes.
- `playwright.config.ts`: all browsers, `webServer` runs `bun run build && bun run preview` on port `4321` plus `WORKTREE_PORT_OFFSET`, `reuseExistingServer: false`. Astro's dev/prod gap is wide (MDX, island hydration, asset optimization), so E2E always tests the built `dist/`. `DIST_PREBUILT` set in the environment drops the `build` half, running `bun run preview` alone against a `dist/` a prior CI job already produced.
- `tsconfig.json`: extends `astro/tsconfigs/strict`, adds `skipLibCheck`, `vitest/globals` and `@testing-library/jest-dom` in types, `@/` paths.
- `card.config.mjs`, `card-src/pages/og-card.astro`, and `scripts/check-card-exclusion.sh`: the social card route, its structural build exclusion, and the check enforcing it. See `## Social card route` below.
- `eslint.config.js`: overrides the web layer. Adds `eslint-plugin-astro` (`.astro` parser via `astro-eslint-parser`). React-hooks scoped to `.jsx`/`.tsx` only (`.astro` is not React). The shared block's `files` selector includes `.astro`, so `check-file/filename-naming-convention` reaches `.ts`, `.tsx`, and `.astro` under `KEBAB_CASE`, overriding Astro's own PascalCase component convention deliberately, on the ground that a component's name in markup comes from the import binding rather than the filename. `.js` and `.jsx` stay out of the rule's own pattern, matching `web` and `nextjs`. `check-file/folder-naming-convention` reaches every `src/**` folder except `__tests__` and the whole `pages/` subtree, which carries its own off-block for the bracket-named dynamic routes and nested slug folders Astro's file-based routing produces. See `canon/context/tooling/stacks.md` for the measurement.

## Typecheck

`astro check` replaces `tsc --noEmit` because `tsc` cannot parse `.astro` files. `build` runs `astro check && astro build`.

## Vitest scope

Unit-test React island components (`.tsx`) only. Do not test `.astro` files. Page-level behavior is verified by Playwright against rendered output.

Vitest is pinned to `^3` in the web manifest. Vitest `^4` bundles rolldown-vite (vite@8), which ignores the esbuild JSX config in `@vitejs/plugin-react` and breaks `.tsx` tests, plus emits deprecation warnings. Unpin once `@astrojs/react` ships a rolldown-aware plugin (or astro's bundled vite reaches 8).

## Setup script

- File: `scripts/setup.sh`. Destructive: deletes `.git` and self-removes after running. Run once immediately after scaffolding.
- Prompt for project name, normalize to kebab-case, derive title-cased display name.
- Update `package.json` name and version, inject verify/clean/update scripts, remove setup.
- Update `astro.config.mjs`: set `site` if provided.
- Update `<title>` and `<meta name="description">` in the default layout.

## Prettier (extend)

Add `prettier-plugin-astro` first in plugins, then `prettier-plugin-tailwindcss` last (per its docs). Add a parser override for `.astro` files.

## Development docs (extend)

Append to the `## Scripts` table:

| `bun run dev` | Start the Astro dev server on port 4321, plus this worktree's port offset. |
| `bun run build` | Run `astro check` then build the static output. |
| `bun run preview` | Serve the built site locally. |
| `bun run astro` | Expose the Astro CLI. |
| `bun run typecheck` | Run `astro check`. |

## CI docs (extend)

In `canon/context/ci.md`, the Typecheck row's assertion reads: `` `astro check` passes ``. The Build row's assertion reads: `` `astro build` succeeds ``. <!-- audit-ignore-citations: canon/context/ci.md -->

## Social card route

The social card is a route the project keeps rather than a page a render writes and deletes, so re-rendering it after a rename is an edit to one string and a re-capture instead of another pass through `draft-identity`'s pick loop with an operator in it. `canon:draft-identity` writes the picked composition into the route and captures it through the server below.

### What ships

- `card.config.mjs`: a second Astro config whose `srcDir` points at `./card-src`, which the main config's page router never reads. That is what excludes the card from the published build structurally rather than by a filename convention, the same mechanism `scenarios.astro` reaches for with `import.meta.env.DEV`. Its base port is `4421` plus `WORKTREE_PORT_OFFSET`, outside the band `astro.config.mjs` serves from, so a card server and a dev server of one worktree never contend.
- `card-src/pages/og-card.astro`: the route, shipped as a working placeholder so it serves before any pick has been taken. It imports the project's own global stylesheet, which is what lets the composition read real tokens and real fonts instead of typed copies. It reads `--color-background` and `--color-text`, the names `canon design css` emits, and sets no `font-family` at all so the card inherits the project's body font rather than reading a font token the design system does not emit.
- `scripts/check-card-exclusion.sh`: fails when the route's `<meta name="og-card-marker">` tag reaches `dist/`, and fails when the route dropped that tag, since the marker is what the leak test reads for.
- `bun run card:dev` serves the route. `bun run card:check` runs the exclusion check, which the web layer's `scripts/verify.sh` also runs after its build stage whenever the script is installed.

### Why each piece is shaped that way

The stylesheet import points at `@/styles/global.css`. A project keeping its stylesheet elsewhere retargets that one line, and an unresolved path then refuses the card server by name, which is the loud direction rather than the convenient one. The quiet failure it replaces is a card captured against no stylesheet at all: it renders as an unstyled box and reports success.

A custom property the stylesheet does not define is the same silent failure in a second costume. It takes its fallback, captures cleanly and reports success, so the card ships on typed values while reading as though it read real ones. That is why the route names only properties `canon design css` emits, and why a project retargeting the stylesheet import checks the names against what its own stylesheet defines.

The exclusion is a check rather than a convention because the route has three consumers and only one of them can be enforced. The card server reads it, the capture reads it, and the published build must not carry it.

`.card` is declared at 600x315, half of the 1200x630 target. `canon capture` opens every page at a fixed 2x device scale factor with no flag to change it, so a half-size element is what lands the captured PNG on the literal size. Declaring it at 1200x630 captures at 2400x1260.

### Why v1 is Astro-only

Astro is the one web stack whose config gives a route a structural build exclusion. Next's App Router has no build-time route exclusion at all, and it needs none on the path it will take, since `ImageResponse` is that framework's own production mechanism and a card route there is meant to be served. `vite-react` builds a single-page app with no page router, so a card is a second Rollup entry rather than a route.

## Gitignore (extend)

`[gitignore]` groups this stack edits, restated here per the manifest-to-reference symmetry:

- `"# Astro" = [".astro/"]`
- `"# Social card" = ["card-dist/"]`

## Scenario switcher

- `src/components/dev/scenarios.astro` ships as a golden config, always overwritten on sync, since it is toolkit-authored infrastructure rather than a file a project hand-edits.
- Import it into a page under test to drive candidate treatments of one decision by hand, selected by a query parameter, with a switcher for moving between them.
- Guarded by `import.meta.env.DEV`, so it renders nothing and ships nothing in a production build.
- Astro-only. It uses `is:inline`, `define:vars`, and `set:html`, which only the `.astro` file format parses. `vite-react` gets no equivalent until a real decision drives one.
