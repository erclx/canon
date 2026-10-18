# Tooling Astro reference

> Extends: `web`. Apply web stack first.

## Overview

The astro stack covers Astro + TypeScript projects, being content sites, marketing sites, blogs, and docs. Interactive islands use React only and output is static.

It ships golden configs for `astro.config.mjs`, `vitest.config.ts`, `playwright.config.ts` (preview-server backed), and a `tsconfig.json` extending `astro/tsconfigs/strict`. An `eslint.config.js` keeps ESLint for this stack alone, and a `.prettierrc` formats `.astro` files alone.

## Scaffold checklist

1. Scaffold with `bunx create-astro@latest`. Choose `TypeScript: Strict`. Skip git init and install.
2. Add React with `bunx astro add react`. Never use `astro add tailwind`, which installs the v3 integration. Tailwind v4 arrives via the web manifest.
3. Install web tooling with `canon tooling sync web . --write`.
4. Install the astro adapter with `canon tooling sync astro . --write`.
5. Extend the `ci` and `development` context entries under `canon/context/` per the web reference's extend sections plus the astro rows below.
6. Run `bun run lint:fix`, then `bun run format`, then `bun run check`.

## What ships as golden configs

### Astro and test configs

The configs below wire Astro into the web layer's test setup.

- `astro.config.mjs` adds `@astrojs/react`, `@tailwindcss/vite` in `vite.plugins`, the `@/` alias via `vite.resolve.alias`, and `ASTRO_SITE` for the `site` field.
- It serves port `4321` plus `WORKTREE_PORT_OFFSET` at `server.port`, with `strictPort` under `vite.server` and `vite.preview`.
- Astro feeds `server.port` through as the preview port but merges the `vite` block into the config backing both servers, so the port sits at the top level and the bind guarantee under `vite`.
- `vitest.config.ts` uses `getViteConfig` from `astro/config`, not `mergeConfig`, with jsdom, globals, the setup file, `passWithNoTests: true`, v8 coverage, and `**/*.astro` in coverage excludes.
- `tsconfig.json` adds `skipLibCheck`, `vitest/globals` and `@testing-library/jest-dom/vitest` in types, and `@/` paths.

### Playwright config

`playwright.config.ts` runs all browsers, with `webServer` running `bun run build && bun run preview` on port `4321` plus `WORKTREE_PORT_OFFSET` and `reuseExistingServer: false`.

- Astro's dev/prod gap is wide (MDX, island hydration, asset optimization), so E2E always tests the built `dist/`.
- `DIST_PREBUILT` in the environment drops the `build` half, running `bun run preview` alone against a `dist/` a prior CI job produced.

### ESLint config

`eslint.config.js` is this stack's own flat config, since the web layer lints with oxlint, which parses no `.astro` file. It adds `eslint-plugin-astro` with `astro-eslint-parser`.

- React hooks apply to `.jsx` and `.tsx` only, since `.astro` is not React.
- `check-file/filename-naming-convention` reaches `.ts`, `.tsx`, and `.astro` under `KEBAB_CASE`, overriding Astro's PascalCase on purpose, since markup names a component by its import binding.
- `.js` and `.jsx` stay out of that rule, matching `web` and `nextjs`.
- `check-file/folder-naming-convention` reaches every `src/**` folder except `__tests__` and the `pages/` subtree, which has its own off-block for bracket-named dynamic routes and slug folders.
- `canon/context/surfaces/tooling.md` carries the measurement behind both naming rules.

The social card files also ship as golden configs, being `card.config.mjs`, `card-src/pages/og-card.astro`, and `scripts/check-card-exclusion.sh`. See `## Social card route` below.

## Typecheck

`astro check` replaces `tsc --noEmit` because `tsc` cannot parse `.astro` files. `build` runs `astro check && astro build`.

## Vitest scope

Unit-test React island components (`.tsx`) only. Do not test `.astro` files, since Playwright verifies page-level behavior against rendered output.

Vitest is pinned to `^5` in the web manifest, which supports the Vite 8 that Astro 7 bundles. The earlier `^3` pin dodged `^4` bundling rolldown-vite, which ignored the esbuild JSX config in `@vitejs/plugin-react`. Astro bundling Vite 8 itself ended that conflict.

## Formatting (extend)

- Format `.astro` files with Prettier and every other file with oxfmt, which loads no Prettier plugin and cannot parse `.astro`.
- Load `prettier-plugin-astro` first in `.prettierrc`'s plugins and `prettier-plugin-tailwindcss` last, with a parser override for `.astro` files.
- Ignore `**/*.astro` in this stack's `.oxfmtrc.json`, so the two formatters never touch one file.
- Copy every other option from base's `.oxfmtrc.json` by hand. Scan takes the child config over the parent's whole file, so a change to base's options is lost here until copied.
- Override `check:format` and `format` to run oxfmt, then Prettier over `**/*.astro`.

## ESLint

- Override `lint` and `lint:fix` back to `eslint . --max-warnings 0`, since the web layer sets them to oxlint.
- Install `eslint@^9`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `eslint-plugin-react-hooks`, `eslint-plugin-vitest`, and `globals`, since the web layer no longer ships them.
- Pin `eslint@^9`, because ESLint 10 dropped the `LegacyESLint` shim `typescript-eslint@8` still imports.
- Expect the web layer's `.oxlintrc.json` in the target. Nothing runs it here.

## Development docs (extend)

Append these rows to the `## Scripts` table.

| Command             | Purpose                                                         |
| ------------------- | --------------------------------------------------------------- |
| `bun run dev`       | Start the Astro dev server on 4321 plus this worktree's offset. |
| `bun run build`     | Run `astro check` then build the static output.                 |
| `bun run preview`   | Serve the built site locally.                                   |
| `bun run astro`     | Expose the Astro CLI.                                           |
| `bun run typecheck` | Run `astro check`.                                              |

## CI docs (extend)

In `canon/context/development/ci.md`, the Typecheck row asserts `` `astro check` passes `` and the Build row asserts `` `astro build` succeeds ``. <!-- audit-ignore-citations: canon/context/development/ci.md -->

## Social card route

The social card is a route the project keeps rather than a page a render writes and deletes. Re-rendering it after a rename is an edit to one string and a re-capture, not another pass through the `design-identity` pick loop.

`canon:design-identity` writes the picked composition into the route and captures it through the server below.

### What ships

The route is a second config, an exclusion check, and two scripts. The page itself is covered below.

- `card.config.mjs` is a second Astro config whose `srcDir` points at `./card-src`, which the main config's page router never reads. That excludes the card from the published build structurally.
- `card.config.mjs` uses base port `4421` plus `WORKTREE_PORT_OFFSET`, outside the band `astro.config.mjs` serves from, so a worktree's card and dev servers never contend.
- `scripts/check-card-exclusion.sh` fails when the route's `<meta name="og-card-marker">` tag reaches `dist/`, and when the route dropped the tag, since the leak test reads it.
- `bun run card:dev` serves the route and `bun run card:check` runs the exclusion check, which base's `scripts/verify.ts` also runs after its build stage when the script is installed.

### Stylesheet and tokens

`card-src/pages/og-card.astro` ships as a working placeholder, so it serves before any pick. It imports the project's global stylesheet to read real tokens and fonts, uses `--color-background` and `--color-text` as `canon design css` emits them, and sets no `font-family`, so the card inherits the body font.

- The import points at `@/styles/global.css`. A project keeping its stylesheet elsewhere retargets that one line.
- An unresolved path refuses the card server by name. That is the loud direction, replacing a card captured against no stylesheet that renders unstyled and reports success.

- A custom property the stylesheet does not define fails the same silent way. It takes its fallback, captures cleanly, and ships typed values.
- So the route names only properties `canon design css` emits, and a project retargeting the import checks the names against its own stylesheet.

### Exclusion and card size

The exclusion is a check rather than a convention because the route has three consumers and only one can be enforced. The card server reads it, the capture reads it, and the published build must not carry it.

`.card` is declared at 600x315, half of the 1200x630 target. `canon capture` opens every page at a fixed 2x device scale factor with no flag to change it, so a half-size element lands the PNG on the literal size. Declaring 1200x630 captures at 2400x1260.

### Why v1 is Astro-only

Astro is the one web stack whose config gives a route a structural build exclusion.

- Next's App Router has no build-time route exclusion, and needs none on its path, since `ImageResponse` is that framework's production mechanism and a card route there is meant to be served.
- `vite-react` builds a single-page app with no page router, so a card is a second Rollup entry rather than a route.

## Gitignore (extend)

These `[gitignore]` groups mirror the manifest.

- `"# Astro" = [".astro/"]`
- `"# Social card" = ["card-dist/"]`

## Scenario switcher

`src/components/dev/scenarios.astro` ships as a golden config, always overwritten on sync, since it is toolkit-authored infrastructure rather than a file a project hand-edits.

- Import it into a page under test to drive candidate treatments of one decision by hand, selected by a query parameter, with a switcher between them.
- It is guarded by `import.meta.env.DEV`, so it renders nothing and ships nothing in a production build.
- It is Astro-only, using `is:inline`, `define:vars`, and `set:html`, which only the `.astro` format parses. `vite-react` gets no equivalent until a real decision drives one.
