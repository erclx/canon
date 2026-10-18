---
description: Enforce Astro static-first rendering, explicit island hydration, content collections, and asset placement
paths:
  - '**/*.astro'
  - 'src/pages/**'
  - 'src/layouts/**'
  - 'src/content/**'
---

# Astro standards

## Static first

- Write a component as `.astro` when it has no client-side state or event handlers, since it renders to HTML with no client JS.
- Fetch page data in the component frontmatter, which runs at build or request time, not in a client island.

## Islands

- Put a `client:*` directive on the framework component itself, imported directly into a `.astro` file.
- Use `client:visible` for a component below the fold and `client:idle` for a low-priority one. Keep `client:load` for interactive UI above the fold.

## Routing and layouts

- Give a dynamic `[param].astro` route a `getStaticPaths()` in static output, which builds only the paths it returns.
- Wrap pages in a layout from `src/layouts/` that renders the page through `<slot />`.

## Content

- Define collections in `content.config.ts` at the root of `src/`, each with a `glob()` or `file()` loader and a Zod schema.
- Read entries through `getCollection()` and `getEntry()`, never by importing content files directly.

## Styles and assets

- Keep component styles scoped. Use `is:global` or `:global()` only for a reset or base style in a layout.
- Keep local images in `src/` so Astro optimizes them. Use `public/` only for files served as-is.

## Environment

- Read variables through `astro:env` with a schema, or `import.meta.env`, and prefix client-exposed ones with `PUBLIC_`.
