# Tooling Astro reference

> Extends: `web`. Apply web stack first.

## Overview

The astro stack covers Astro + TypeScript projects, being content sites, marketing sites, blogs, and docs. Interactive islands use React only and output is static.

## Scaffold checklist

1. Scaffold with `bunx create-astro@latest`. Choose `TypeScript: Strict`. Skip git init and install.
2. Add React with `bunx astro add react`. Never use `astro add tailwind`, which installs the v3 integration. Tailwind v4 arrives via the web manifest.
3. Install web tooling with `canon tooling sync web . --write`.
4. Install the astro adapter with `canon tooling sync astro . --write`.
5. Extend the `ci` and `development` context entries under `canon/context/` per the web reference's extend sections plus the astro rows below.
6. Run `bun run lint:fix`, then `bun run format`, then `bun run check`.

## Astro config

- `astro.config.mjs` adds `@astrojs/react`, `@tailwindcss/vite` in `vite.plugins`, the `@/` alias via `vite.resolve.alias`, and `ASTRO_SITE` for the `site` field
- It serves port `4321` plus `WORKTREE_PORT_OFFSET` at `server.port`, with `strictPort` under `vite.server` and `vite.preview`
- Keep the port at the top level and the bind guarantee under `vite`, since Astro feeds `server.port` through as the preview port but merges the `vite` block into both servers

## TypeScript

- `tsconfig.json` extends `astro/tsconfigs/strict` and adds `skipLibCheck`, `vitest/globals` and `@testing-library/jest-dom/vitest` in types, and `@/` paths
- Typecheck with `astro check` in place of `tsc --noEmit`, since `tsc` cannot parse `.astro` files
- `build` runs `astro check && astro build`

## Vitest

- `vitest.config.ts` uses `getViteConfig` from `astro/config`, not `mergeConfig`, with jsdom, globals, the setup file, `passWithNoTests: true`, and v8 coverage
- Exclude `**/*.astro` from coverage, and unit-test React island components (`.tsx`) alone, since Playwright verifies page-level behavior against rendered output
- Keep Vitest at `^5` from the web manifest, which supports the Vite 8 that Astro 7 bundles

## Playwright

- `playwright.config.ts` runs all browsers, with `webServer` running `bun run build && bun run preview` on port `4321` plus `WORKTREE_PORT_OFFSET` and `reuseExistingServer: false`
- Test the built `dist/`, since Astro's dev and production gap is wide across MDX, island hydration, and asset optimization
- Set `DIST_PREBUILT` to drop the `build` half, running `bun run preview` alone against a `dist/` a prior CI job produced

## ESLint

- Lint with this stack's own flat `eslint.config.js`, since the web layer's oxlint parses no `.astro` file. It adds `eslint-plugin-astro` with `astro-eslint-parser`.
- Expect `lint` and `lint:fix` overridden back to `eslint . --max-warnings 0`, and the web layer's `.oxlintrc.json` in the target with nothing running it
- Install `eslint@^9`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `eslint-plugin-react-hooks`, `eslint-plugin-vitest`, and `globals`, since the web layer ships none of them
- Pin `eslint@^9`, because ESLint 10 dropped the `LegacyESLint` shim `typescript-eslint@8` still imports

## ESLint naming rules

- Apply React hooks rules to `.jsx` and `.tsx` alone, since `.astro` is not React
- Name `.ts`, `.tsx`, and `.astro` files in `KEBAB_CASE`, overriding Astro's PascalCase, since markup names a component by its import binding
- Keep `.js` and `.jsx` out of that rule, matching `web` and `nextjs`
- Name every `src/**` folder in kebab case except `__tests__` and the `pages/` subtree, whose own off-block allows bracket-named dynamic routes and slug folders

## Formatting (extend)

- Format `.astro` files with Prettier and every other file with oxfmt, which loads no Prettier plugin and cannot parse `.astro`
- Load `prettier-plugin-astro` first in `.prettierrc`'s plugins and `prettier-plugin-tailwindcss` last, with a parser override for `.astro` files
- Ignore `**/*.astro` in this stack's `.oxfmtrc.json`, so the two formatters never touch one file
- Expect this stack's `.oxfmtrc.json` to replace base's whole file, so a base option change reaches a target only once this stack copies it
- Override `check:format` and `format` to run oxfmt, then Prettier over `**/*.astro`

## Social card route

- Keep the social card as a route the project owns, so a re-render after a rename is one string edit and a re-capture rather than another `design-identity` pick loop
- Expect `canon:design-identity` to write the picked composition into the route and capture it through the card server, which runs with Astro's dev toolbar off so it never paints over the card
- `card.config.mjs` is a second Astro config whose `srcDir` points at `./card-src`, which the main page router never reads, so the published build excludes the card structurally
- It serves on base port `4421` plus `WORKTREE_PORT_OFFSET`, outside the band `astro.config.mjs` serves from, so a worktree's card and dev servers never contend
- `bun run card:dev` serves the route and `bun run card:check` runs the exclusion check, which base's `scripts/verify.ts` also runs after its build stage

## Card exclusion and size

- `scripts/check-card-exclusion.sh` fails when the route's `<meta name="og-card-marker">` tag reaches `dist/`, and when the route dropped the tag the leak test reads
- The filename test reads built HTML pages only, under an `og-card` path in either build format, so an image or font may carry the route's name
- Keep the exclusion a check rather than a convention, since the card server and the capture read the route and the published build must not carry it
- Declare `.card` at 600x315, half the 1200x630 target, since `canon capture` shoots at a fixed 2x device scale and 1200x630 would capture at 2400x1260

## Card stylesheet and tokens

- `card-src/pages/og-card.astro` ships as a working placeholder, so it serves before any pick
- It imports `@/styles/global.css` for real tokens and fonts, and a project keeping its stylesheet elsewhere retargets that one line
- It uses `--color-background` and `--color-text` as `canon design css` emits them, and sets no `font-family`, so the card inherits the body font
- Expect an unresolved stylesheet path to refuse the card server by name, rather than capture an unstyled card that reports success
- Name only properties `canon design css` emits, since an undefined one silently takes its fallback, and check the names against a retargeted stylesheet

## Card route scope

- Expect no card route on another web stack, since Astro is the one whose config gives a route a structural build exclusion
- Next's App Router has none and needs none, since `ImageResponse` is its production mechanism and a card route there is meant to be served
- `vite-react` builds a single-page app with no page router, so a card there is a second Rollup entry rather than a route

## Scenario switcher

- Expect `src/components/dev/scenarios.astro` overwritten on every sync, since it is toolkit-authored infrastructure rather than a file a project hand-edits
- Import it into a page under test to drive candidate treatments of one decision by hand, selected by a query parameter, with a switcher between them
- Rely on its `import.meta.env.DEV` guard, so it renders nothing and ships nothing in a production build
- Expect it on Astro alone, since it uses `is:inline`, `define:vars`, and `set:html`, which only the `.astro` format parses

## Development docs (extend)

- Append these rows to the `## Scripts` table

| Command             | Purpose                                                         |
| ------------------- | --------------------------------------------------------------- |
| `bun run dev`       | Start the Astro dev server on 4321 plus this worktree's offset. |
| `bun run build`     | Run `astro check` then build the static output.                 |
| `bun run preview`   | Serve the built site locally.                                   |
| `bun run astro`     | Expose the Astro CLI.                                           |
| `bun run typecheck` | Run `astro check`.                                              |

## CI docs (extend)

- Assert `` `astro check` passes `` on the Typecheck row of `canon/context/development/ci.md` <!-- audit-ignore-citations: canon/context/development/ci.md -->
- Assert `` `astro build` succeeds `` on its Build row
