---
description: Enforce opinionated React architecture and component patterns
paths:
  - '**/*.tsx'
  - '**/*.ts'
---

# React architecture standards

## Export conventions

- Use named exports exclusively for components and hooks.
- Do not use default exports.

## Project structure

- Place domain logic in `src/features/` and restrict `src/components/` to shared UI.
- Do not place feature-specific components in the global components folder.
- Import environment variables only from the validated configuration module.

## Component patterns

- Use function declarations for components over arrow functions.
- Define TypeScript interfaces for props immediately above the component.
- Use `<>` shorthand for fragments unless key prop is required.
- Use stable, unique keys for list items over array index.
- Extract components when JSX exceeds a single responsibility.

## State and effects

- Encapsulate data fetching and complex effects in custom hooks.
- Use `useMemo` for derived state over `useEffect`.
- Do not call `setState` inside `useEffect` to sync derived state. The `react-hooks/set-state-in-effect` lint enforces this.
- Compare the previous value during render and call `setState` from the render body when it changes, over syncing in an effect.
- Lift the state to a parent and reset the child with a `key` prop, over running a reset effect in the child.
- Return a sentinel (`undefined` or a `useSyncExternalStore` placeholder) from hooks that hydrate asynchronously and gate consumers on it, over running a hydration effect.

## Memoization

- Memoize components receiving non-primitive props with `React.memo`.
- Use `useCallback` for handler props passed to children.

## Composition and props

- Avoid prop drilling beyond 2 levels. Use context or composition.

## Error boundaries and Suspense

- Place error boundaries at route level.
- Place Suspense at data-fetching boundaries.
- Do not use a single root-level error boundary as the only safety net.
