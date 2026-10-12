---
description: Enforce strict TypeScript type safety and patterns
paths:
  - '**/*.ts'
  - '**/*.tsx'
---

# TypeScript standards

## Casing conventions

- Use `kebab-case` for filenames and directories.
- Use `camelCase` for variables, functions, and methods.
- Use `PascalCase` for types, interfaces, classes, and components.
- Use `UPPER_SNAKE_CASE` for constants and environment variables.

## Type declarations

- Enforce explicit types or strict inference.
- Use `unknown` over `any`.
- Use `interface` for object shapes and component props.
- Use `type` for unions, intersections, and utility types.
- Do not prefix interfaces with `I`.
- Use constant objects or union types instead of `enum`.

## Type safety

- Use type guards and narrowing over type assertions.
- Use discriminated unions for error handling over throwing exceptions.
- Use built-in utility types (`Partial`, `Pick`, `Omit`) over manual type manipulation.
- Prefer `readonly` properties for data objects.
- Do not use non-null assertions.
- Use `Promise.all()` for independent async operations.

## Imports and configuration

- Use absolute imports mapping `@/` to `src/`.
- Import from the module's source file directly over barrel `index` re-exports.
- Use `import type` for type-only imports.
- Enable `strict: true` in tsconfig.json with no exceptions.
