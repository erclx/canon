---
title: TypeScript rule ledger
description: Sources for governance/rules/lang/typescript.md, one row per bullet
---

# TypeScript rule ledger

The field is TypeScript programming, and the authority is the TypeScript documentation at typescriptlang.org, with MDN for the JavaScript runtime the language compiles to. The handbook names no release, so rows read the handbook as TypeScript 5.

## File names

| Bullet                 | Source                                                                                                                                                                         | Read       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `kebab-case` filenames | House choice: an import differing from its file only in case resolves on a case-insensitive filesystem such as macOS and fails on Linux CI, and one casing leaves no such pair | 2026-10-18 |

## Type declarations

| Bullet                             | Source                                                                                                                                                                                                      | Read                     |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `unknown` over `any`               | [More on Functions](https://www.typescriptlang.org/docs/handbook/2/functions.html): `unknown` "is similar to the `any` type, but is safer because it's not legal to do anything with an `unknown` value"    | 2026-10-18, TypeScript 5 |
| `interface` until `type` is needed | [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html): "If you would like a heuristic, use `interface` until you need to use features from `type`."                          | 2026-10-18, TypeScript 5 |
| `as const` over `enum`             | [Enums](https://www.typescriptlang.org/docs/handbook/enums.html): "you may not need an enum when an object with `as const` could suffice", which "keeps your codebase aligned with the state of JavaScript" | 2026-10-18, TypeScript 5 |

## Type safety

| Bullet                             | Source                                                                                                                                                                                                                                                                         | Read                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| Narrow over assert or `!`          | [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html): "there is no runtime checking associated with a type assertion", and the non-null `!` likewise "doesn't change the runtime behavior of your code"                                        | 2026-10-18, TypeScript 5 |
| `Promise.all` for independent work | [Promise.all()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all): sequential `await` makes the function "pause until the choice is made, and then again until the prices are fetched", and `Promise.all` runs "them concurrently" | 2026-10-18               |

## Imports and configuration

| Bullet                  | Source                                                                                                                                                                                                                                                                                                                 | Read                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `@/` alias where mapped | House choice: a `../../` chain breaks whenever the importing file moves. The condition comes from [Modules reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html), where `paths` "does not change the import path in the code emitted", so an alias the bundler lacks "will crash at runtime" | 2026-10-18, TypeScript 5 |
| No barrel re-exports    | House choice: importing through a barrel loads every module it re-exports, which slows tests and opens import cycles that surface as `undefined` at load time                                                                                                                                                          | 2026-10-18               |
| `import type`           | [TypeScript 3.8](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html): `import type` "always gets fully erased, so there's no remnant of it at runtime"                                                                                                                                     | 2026-10-18, TypeScript 5 |
| `strict: true`          | [TSConfig strict](https://www.typescriptlang.org/tsconfig/#strict): "The strict flag enables a wide range of type checking behavior that results in stronger guarantees of program correctness"                                                                                                                        | 2026-10-18, TypeScript 5 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Cut without a source or a bug class

- Cut "enforce explicit types or strict inference", which no reviewer can check against a line of code.
- Cut "discriminated unions for error handling over throwing exceptions". No TypeScript page takes that side, and this repository's own CLI throws, so the bullet loaded against the code it governs.
- Cut "built-in utility types over manual type manipulation". The utility types page describes them and sets them against nothing.
- Cut "prefer `readonly` properties for data objects". The object types page describes `readonly` and takes no side on when to use it.

### A convention Claude follows unprompted

- Cut "`camelCase` for variables, functions, and methods".
- Cut "`PascalCase` for types, interfaces, classes, and components".
- Cut "`UPPER_SNAKE_CASE` for constants and environment variables".
- Cut "do not prefix interfaces with `I`", a prefix Claude does not write without being asked.

### Merged or reworded

- Reworded the `interface` bullet to the handbook's heuristic, and merged "`type` for unions, intersections, and utility types" into it as the point where `type` takes over.
- Merged "do not use non-null assertions" into the narrowing bullet, since the handbook groups `!` with the type assertion it is.
- Reworded the `@/` bullet to apply only where both tsconfig.json and the bundler map the alias, under the plan's question 2, whose suggestion stood.
- Moved the `kebab-case` filename bullet under a `File names` heading, since it was the one casing bullet kept, and gave it the case-sensitivity reason.
- Gave the `unknown` bullet the narrowing step `unknown` requires before use.
