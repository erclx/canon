---
description: Enforce astro static-first architecture with explicit island opt-in
paths:
  - '**/*.astro'
  - 'src/pages/**'
  - 'src/layouts/**'
  - 'src/content/**'
---

# Astro standards

## Static first

- Write pages and components as `.astro` unless interactivity requires a framework island.
- Do not add a framework integration until the first island needs it.
- Prefer server-rendered content over client-fetched data.

## Islands

- Apply `client:*` directives on the component boundary, not on parents.
- Prefer `client:visible` or `client:idle` over `client:load`. Use `client:load` only for above-the-fold interactivity.
- Keep islands leaf-level. Do not wrap layout chrome in a framework component to enable nested islands.

## Routing and layouts

- Place routes in `src/pages/`. Use `[param].astro` for dynamic segments and `[...rest].astro` for catch-alls.
- Extract shared chrome into `src/layouts/` and compose pages with a `<Layout>` wrapper.

## Content

- Use content collections in `src/content/` with a `config.ts` schema for any repeated structured content.
- Access collection entries via `getCollection` and `getEntry` over direct file imports.

## Styles and assets

- Component styles are scoped by default. Use `is:global` only in layouts for reset or base styles.
- Import images from `src/assets/` to get optimization. Use `public/` only for untouched static files.

## Environment

- Read environment variables via `import.meta.env`. Prefix client-exposed variables with `PUBLIC_`.
