---
description: Enforce React render purity, state derivation, memoization, and boundary placement
paths:
  - '**/*.tsx'
  - '**/*.ts'
---

# React standards

## Rendering

- Keep components and hooks pure during render. Move side effects and `Math.random()` into an event handler or an effect.
- Never mutate props or state. Build a new value and pass it to the `useState` setter.
- Key list items by a stable ID from the data, never by array index or a value generated during render.

## State and effects

- Calculate a value derivable from props or state during render, never in an effect that syncs it into state.
- Reset a child's state by passing it a new `key`, over a reset effect in the child.
- Read a browser or external store with `useSyncExternalStore` and a `getServerSnapshot` matching the server output.
- Wrap a data-fetching effect in a custom hook whose cleanup ignores stale responses, when the framework has no fetching primitive.

## Memoization

- Leave memoization to React Compiler where it is enabled, as React recommends for new code. Add `useMemo` only for precise control.
- Without the compiler, memoize only a calculation measured at 1ms or more, or a value a `memo` child or a Hook dependency reads.

## Composition

- Pass props first, then extract components and pass JSX as `children`. Reach for context only when neither works.

## Error and loading boundaries

- Place an error boundary where an error message makes sense, such as around a list and each item, never around every component.
- Expect Suspense to catch `lazy`, `use` on a cached Promise, or a framework loader, never a fetch inside an effect.
- Place Suspense boundaries to match the loading sequence the user should see.

## Exports

- Use named exports for components and hooks, since a default export renamed at import drifts from its name in a search.
