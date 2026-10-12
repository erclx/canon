---
description: Enforce tanstack query data fetching and cache patterns
paths:
  - '**/*.ts'
  - '**/*.tsx'
---

# TanStack Query standards

## Query conventions

- Define query keys as `readonly` tuple constants.
- Co-locate query keys with their query functions.
- Encapsulate each query in a custom `use*Query` hook over calling `useQuery` inline in components.
- Set explicit `staleTime` per query based on data volatility over relying on the default.

## Mutations

- Use `useMutation` for all write operations.
- Never mutate data outside the mutation lifecycle.
- Invalidate related query keys in `onSuccess` over manual cache updates unless optimistic UI is required.
- Handle `onError` at the mutation site with user-facing feedback.

## Cache management

- Use `queryClient.invalidateQueries` over `queryClient.setQueryData` unless implementing optimistic updates.
- Prefetch predictable navigations with `queryClient.prefetchQuery` at route boundaries.

## Separation of concerns

- Keep query functions as pure async data fetchers with no UI logic or side effects.
- Use the query `enabled` option for conditional fetching over `useEffect`.
