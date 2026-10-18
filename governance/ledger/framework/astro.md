---
title: Astro rule ledger
description: Sources for governance/rules/framework/astro.md, one row per bullet
---

# Astro rule ledger

The field is front-end engineering, and the authority is the Astro documentation at docs.astro.build. The pages read name no current major, so most rows record the read date alone. The content rows follow the Astro 6 upgrade guide, which removed the legacy collection location.

## Static first

| Bullet                        | Source                                                                                                                                                                               | Read       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `.astro` without client state | [Islands architecture](https://docs.astro.build/en/concepts/islands/): Astro components "render to static HTML with no client-side runtime"                                          | 2026-10-18 |
| Fetch in the frontmatter      | [Data fetching](https://docs.astro.build/en/guides/data-fetching/): "All Astro components have access to the global fetch() function in their component script", run "at build time" | 2026-10-18 |

## Islands

| Bullet                         | Source                                                                                                                                                                                                                            | Read       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Directive on the component     | [Template directives](https://docs.astro.build/en/reference/directives-reference/): "A client directive can only be used on a UI framework component that is directly imported into a .astro component"                           | 2026-10-18 |
| Pick the directive by priority | [Template directives](https://docs.astro.build/en/reference/directives-reference/): `client:load` is for "Immediately-visible UI elements", `client:idle` for "Lower-priority UI elements", `client:visible` for "below the fold" | 2026-10-18 |

## Routing and layouts

| Bullet                        | Source                                                                                                                                                                                                    | Read       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `getStaticPaths()` for params | [Routing](https://docs.astro.build/en/guides/routing/): in static mode every parameter value needing a page comes from `getStaticPaths()`, while "In SSR mode, a page will be generated on request"       | 2026-10-18 |
| Layouts with `<slot />`       | [Layouts](https://docs.astro.build/en/basics/layouts/): "Layouts are Astro components used to provide a reusable UI structure", with "a slot to specify where individual page content should be injected" | 2026-10-18 |

## Content

| Bullet                          | Source                                                                                                                                                                                                                            | Read                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `src/content.config.ts` loaders | [Content collections](https://docs.astro.build/en/guides/content-collections/): "All of your build-time content collections are defined in a special src/content.config.ts file", with "two built-in loaders (glob() and file())" | 2026-10-18, Astro 6 |
| Query through the API           | [Content collections](https://docs.astro.build/en/guides/content-collections/): "getCollection() fetches an entire collection and returns an array of entries"                                                                    | 2026-10-18          |

## Styles and assets

| Bullet            | Source                                                                                                                                                                       | Read       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Scoped by default | [Styles and CSS](https://docs.astro.build/en/guides/styling/): "Scoped styles should be used as often as possible" and "Global styles should be used only as-needed"         | 2026-10-18 |
| Images in `src/`  | [Images](https://docs.astro.build/en/guides/images/): "We recommend that local images are kept in src/ when possible so that Astro can transform, optimize, and bundle them" | 2026-10-18 |

## Environment

| Bullet                    | Source                                                                                                                                                                                                                | Read       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `astro:env` and `PUBLIC_` | [Environment variables](https://docs.astro.build/en/guides/environment-variables/): "only environment variables prefixed with PUBLIC\_ are available in client-side code", and `astro:env` gives "a type-safe schema" | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the docs

- Replaced "content collections in `src/content/` with a `config.ts` schema". The [Astro 6 upgrade guide](https://docs.astro.build/en/guides/upgrade-to/v6/) removed that location in favor of `src/content.config.ts`.

### Cut without a source or a bug class

- Cut "do not add a framework integration until the first island needs it" as a dependency call with no page read taking a side.
- Cut "keep islands leaf-level, never wrap layout chrome to enable nested islands", which no reviewer can check against one line.
- Cut "use `[param].astro` and `[...rest].astro`" as the file convention Claude already follows. The kept routing bullet names the `getStaticPaths()` footgun instead.

### Merged or reworded

- Reworded the hedged "write pages and components as `.astro` unless interactivity requires an island" to a test on client state and event handlers.
- Reworded the hedged "prefer server-rendered content over client-fetched data" to where the fetch call sits.
- Reworded "apply `client:*` directives on the component boundary, not on parents" to the rule the directives reference states.
- Reworded "prefer `client:visible` or `client:idle` over `client:load`" to the priority each directive is documented for.
- Merged "access collection entries via `getCollection` and `getEntry`" into the query bullet.
- Reworded "use `is:global` only in layouts" to include `:global()`, the selector the styling page names for the same case.
- Extended "read environment variables via `import.meta.env`" with `astro:env`, the typed schema the docs now offer.
