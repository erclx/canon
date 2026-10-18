---
title: TanStack Query rule ledger
description: Sources for governance/rules/lib/tanstack-query.md, one row per bullet
---

# TanStack Query rule ledger

The field is client-side data fetching in React, and the authority is the TanStack Query documentation at tanstack.com. The pages read are the latest docs, which name no major but deprecate `prefetchQuery`, so the prefetch bullet names the route loader rather than either method. `queryOptions()` needs TanStack Query 5 or later.

## Query conventions

| Bullet                         | Source                                                                                                                                                                                                                                    | Read               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `queryOptions()` at every site | [Query options](https://tanstack.com/query/latest/docs/framework/react/guides/query-options): it lets you "share `queryKey` and `queryFn` between multiple places", with "type inference and type safety for all of them"                 | 2026-10-18, latest |
| Every variable in the key      | [Query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys): "If your query function depends on a variable, include it in your query key"                                                                      | 2026-10-18, latest |
| `staleTime` per query          | [Important defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults): queries "consider cached data as stale" by default, and setting `staleTime` is "the recommended way to avoid excessive refetches" | 2026-10-18, latest |
| Throw on a non-`ok` response   | [Query functions](https://tanstack.com/query/latest/docs/framework/react/guides/query-functions): a query function "must throw or return a rejected Promise", and `fetch` does not "throw errors by default"                              | 2026-10-18, latest |

## Mutations

| Bullet                          | Source                                                                                                                                                                                                                                   | Read               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Writes through `useMutation`    | House choice: a write outside a mutation has no pending or error state and invalidates nothing, so the cache keeps serving what the write replaced                                                                                       | 2026-10-18, latest |
| Invalidate in `onSuccess`       | [Invalidations from mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations): "Returning a Promise on `onSuccess` makes sure the data is updated before the mutation is entirely complete" | 2026-10-18, latest |
| `onError` with visible feedback | House choice: a failed write with no handler leaves the screen showing the edit as if it saved                                                                                                                                           | 2026-10-18, latest |

## Cache management

| Bullet                       | Source                                                                                                                                                                                                | Read               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Prefetch in the route loader | [Prefetching](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching): a loader starts a route's data ahead of render, with "Fetch comments asap, but don't block or throw errors" | 2026-10-18, latest |

## Separation of concerns

| Bullet                     | Source                                                                                                                                                                                                                        | Read               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Pure query functions       | [Important defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults): stale queries refetch when "The window is refocused" and "The network is reconnected", so a side effect fires on each | 2026-10-18, latest |
| `enabled`, not `useEffect` | [Dependent queries](https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries): "using the `enabled` option to tell a query when it is ready to run"                                                    | 2026-10-18, latest |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the docs

- Reworded "prefetch predictable navigations with `queryClient.prefetchQuery`". The [prefetching guide](https://tanstack.com/query/latest/docs/framework/react/guides/prefetching) calls `prefetchQuery` "now deprecated", and a target on an older major still has it, so the bullet names the loader alone.

### Merged or reworded

- Merged "define query keys as `readonly` tuple constants", "co-locate query keys with their query functions", and "encapsulate each query in a custom `use*Query` hook" into the `queryOptions()` bullet, the helper the docs name for sharing a key with its function.
- Merged "never mutate data outside the mutation lifecycle" into the `useMutation` bullet.
- Merged "use `invalidateQueries` over `setQueryData` unless implementing optimistic updates" into the `onSuccess` bullet.

### Gaps filled

- Added the bullet putting every variable in the key, the stale-data bug the query keys page warns about.
- Added the bullet throwing on a response that is not `ok`, since a `fetch` query function otherwise caches an error body as data.
