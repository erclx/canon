---
description: Enforce tanstack query data fetching and cache patterns
paths:
  - '**/*.ts'
  - '**/*.tsx'
---

# TanStack Query standards

## Query conventions

- Define a query's key and function together with `queryOptions()`, and reuse that object at every call site.
- Include every variable the query function reads in its query key.
- Set `staleTime` per query from how often its data changes, since the default treats cached data as stale at once.
- Throw from a query function on a response that is not `ok`, since `fetch` does not reject on an HTTP error.

## Mutations

- Write data through `useMutation`, never by calling the API from an event handler and patching the cache.
- Invalidate the related query keys in `onSuccess` and return that promise. Reserve `setQueryData` for an optimistic update.
- Handle `onError` at the mutation site with feedback the user sees.

## Cache management

- Prefetch a predictable navigation's data in its route loader.

## Separation of concerns

- Keep a query function a pure data fetcher with no UI logic or side effects, since a background refetch runs it again.
- Use the query `enabled` option for a conditional or dependent fetch, never `useEffect`.
