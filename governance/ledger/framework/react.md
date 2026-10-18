---
title: React rule ledger
description: Sources for governance/rules/framework/react.md, one row per bullet
---

# React rule ledger

The field is front-end engineering, and the authority is the React team's documentation at react.dev. The rewrite started from groundwork spike S2's draft and reads its three unread leads.

## Rendering

| Bullet                      | Source                                                                                                                                                                                           | Read                 |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| Pure during render          | [Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure): side effects "should not run in render, as React can render components multiple times" | 2026-10-18, React 19 |
| Never mutate props or state | [Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure): "A component's props and state are immutable snapshots. Never mutate them directly."   | 2026-10-18, React 19 |
| Stable data keys, not index | [Rendering lists](https://react.dev/learn/rendering-lists): "Index as a key often leads to subtle and confusing bugs" and "do not generate keys on the fly"                                      | 2026-10-18, React 19 |

## State and effects

| Bullet                                        | Source                                                                                                                                                                                                                                                                | Read                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Derive during render                          | [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect): "When something can be calculated from the existing props or state, don't put it in state. Instead, calculate it during rendering."                                             | 2026-10-18, React 19 |
| Reset with `key`                              | [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect): "To reset the state of an entire component tree, pass a different key to it."                                                                                                   | 2026-10-18, React 19 |
| External store through `useSyncExternalStore` | [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore): a browser value "can change without React's knowledge, so you should read it with useSyncExternalStore", and the server snapshot "must be the same between the client and the server" | 2026-10-18, React 19 |
| Fetching effect in a custom hook              | [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect): a race "needs a cleanup function to ignore stale responses", and moving fetching "into a custom Hook will make it easier to adopt an efficient data fetching strategy later"    | 2026-10-18, React 19 |

## Memoization

| Bullet                           | Source                                                                                                                                                                                                                                              | Read                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Leave it to the compiler         | [React Compiler introduction](https://react.dev/learn/react-compiler/introduction): "For new code, we recommend relying on the compiler for memoization and using useMemo/useCallback where needed to achieve precise control."                     | 2026-10-18, React Compiler 1 |
| Without it, memoize only by need | [useMemo](https://react.dev/reference/react/useMemo): worth it for a noticeably slow calculation, "say, 1ms or more", a prop to a `memo` child, or a Hook dependency, and "There is no benefit to wrapping a calculation in useMemo in other cases" | 2026-10-18, React 19         |

## Composition

| Bullet                        | Source                                                                                                                                                                                                                                                | Read                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Props, children, then context | [Passing data deeply with context](https://react.dev/learn/passing-data-deeply-with-context): "Start by passing props", then "Extract components and pass JSX as children", and "If neither of these approaches works well for you, consider context" | 2026-10-18, React 19 |

## Error and loading boundaries

| Bullet                                       | Source                                                                                                                                                                                                             | Read                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| Error boundaries where a message makes sense | [Component](https://react.dev/reference/react/Component): "consider where it makes sense to display an error message", around the conversation list and each message, and "You don't need to wrap every component" | 2026-10-18, React 19 |
| What activates Suspense                      | [Suspense](https://react.dev/reference/react/Suspense): "Suspense does not detect when data is fetched inside an Effect or event handler"                                                                          | 2026-10-18, React 19 |
| Boundaries follow the loading sequence       | [Suspense](https://react.dev/reference/react/Suspense): "Suspense boundaries should not be more granular than the loading sequence that you want the user to experience"                                           | 2026-10-18, React 19 |

## Exports

| Bullet        | Source                                                                                                   | Read       |
| ------------- | -------------------------------------------------------------------------------------------------------- | ---------- |
| Named exports | House choice: a default export renamed at import drifts from the component's name, so a search misses it | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the docs

- Replaced "`useMemo` for derived state over `useEffect`" with the derive bullet. The effect page says "calculate it during rendering" and keeps `useMemo` for a slow calculation.
- Cut "memoize components receiving non-primitive props" as contradicted. [memo](https://react.dev/reference/react/memo) is "completely useless if the props passed to your component are always different, such as if you pass an object".
- Cut "memoize every handler passed to a child" as contradicted. [useCallback](https://react.dev/reference/react/useCallback) says "There is no benefit to wrapping a function in useCallback in other cases" than a `memo` child or a Hook dependency.
- Cut "no passing props past two levels" as contradicted, since the context page says "it's not unusual to pass a dozen props down through a dozen components".

### Cut without a source or a bug class

- Cut "domain logic in `src/features/`, shared UI in `src/components/`" as a layout call, which the `codebase-layout` skill owns.
- Cut "no feature components in the global components folder" as the same layout call.
- Cut "environment variables only from the validated config module", which is no React practice and which no react.dev page takes a side on.
- Cut "function declarations over arrow functions" as style with no bug class, and no react.dev page takes a side.
- Cut "props interface directly above the component" as style with no bug class.
- Cut "extract components when JSX exceeds one responsibility", which no reviewer can check against a line of code.
- Cut "compare the previous value and set state during render", since [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) says "most components shouldn't need it either" and ranks it after a key reset.
- Cut "use `<>` unless a key is needed" as a convention Claude already follows. [Rendering lists](https://react.dev/learn/rendering-lists) says the shorthand "won't let you pass a key".

### Merged or reworded

- Merged "no default exports" into the named-exports bullet, which states the same choice.
- Narrowed "custom hooks for all fetching and complex effects" to data fetching, since [Reusing logic with custom hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) says "you can (but don't have to) extract custom Hooks".
- Merged "no `setState` in an effect to sync derived state" into the derive bullet, the same ban. Only the `web` and `nextjs` oxlint configs error on `react/set-state-in-effect`.
- Reworded "a sentinel from asynchronously hydrating hooks" to `useSyncExternalStore` with a matching server snapshot, the API the reference names for a value React does not own.
- Reworded "error boundaries at route level", since the reference places a boundary by where a message makes sense rather than at a fixed level.
- Merged "no single root error boundary as the only net" into the placement bullet.
