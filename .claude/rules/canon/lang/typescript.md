---
description: Enforce strict TypeScript type safety, declarations, and import patterns
paths:
  - '**/*.ts'
  - '**/*.tsx'
---

# TypeScript standards

## File names

- Use `kebab-case` for filenames and directories, since a case-only difference resolves on macOS and fails on Linux.

## Type declarations

- Use `unknown` over `any`, and narrow it before use.
- Use `interface` for an object shape until it needs a feature only `type` has, such as a union or a mapped type.
- Use a constant object with `as const` or a union of literals instead of `enum`.

## Type safety

- Narrow with a type guard or a runtime check over a type assertion or a non-null `!`, neither of which checks at runtime.
- Run independent async operations through `Promise.all()` rather than awaiting each in turn.

## Imports and configuration

- Import through the `@/` alias where tsconfig.json and the bundler both map it to `src/`, over a `../../` chain.
- Import from the module's source file directly over barrel `index` re-exports.
- Use `import type` for type-only imports.
- Enable `strict: true` in tsconfig.json with no exceptions.
