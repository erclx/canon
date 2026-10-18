---
title: Zod rule ledger
description: Sources for governance/rules/lib/zod.md, one row per bullet
---

# Zod rule ledger

The field is TypeScript runtime validation, and the authority is the Zod documentation at zod.dev with its changelog in the colinhacks/zod repository. The rule assumes Zod 4, since the methods it replaces stay available as legacy and a Zod 3 target keeps `z.strictObject()`.

## Type inference

| Bullet                       | Source                                                                                                                                                 | Read              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| `z.infer`, no twin interface | [Basic usage](https://zod.dev/basics): "Zod infers a static type from your schema definitions. You can extract this type with the `z.infer<>` utility" | 2026-10-18, Zod 4 |

## Boundary validation

| Bullet                                | Source                                                                                                                                                                                                                                       | Read              |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `z.strictObject()` on untrusted input | [Zod 4 changelog](https://raw.githubusercontent.com/colinhacks/zod/main/packages/docs/content/v4/changelog.mdx): "Instead use the top-level `z.strictObject()` and `z.looseObject()` functions", and the old methods "are considered legacy" | 2026-10-18, Zod 4 |
| `.pick()` or `.omit()`, not loose     | [Defining schemas](https://zod.dev/api): "Zod provides dedicated APIs for picking and omitting certain keys from an object schema", and a loose schema "allows unknown keys to pass through"                                                 | 2026-10-18, Zod 4 |
| `.parse()` or `.safeParse()`          | [Basic usage](https://zod.dev/basics): `.parse()` "will throw a `ZodError`", and `.safeParse()` returns "a plain result object containing either the successfully parsed data or a `ZodError`"                                               | 2026-10-18, Zod 4 |
| `z.coerce` at string boundaries       | [Defining schemas](https://zod.dev/api): "The coerced variant of these schemas attempts to convert the input value to the appropriate type", applying `String(input)` for `z.coerce.string()`                                                | 2026-10-18, Zod 4 |

## Schema safety

| Bullet                       | Source                                                                                              | Read              |
| ---------------------------- | --------------------------------------------------------------------------------------------------- | ----------------- |
| `z.unknown()`, not `z.any()` | [Defining schemas](https://zod.dev/api): `z.any()` infers `any`, and `z.unknown()` infers `unknown` | 2026-10-18, Zod 4 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the docs

- Replaced "use `.strict()` for untrusted external API boundaries". The [Zod 4 changelog](https://raw.githubusercontent.com/colinhacks/zod/main/packages/docs/content/v4/changelog.mdx) marks `.strict()` legacy and names `z.strictObject()`.
- Replaced "prefer `.strict()` at boundaries or explicit `.pick()`/`.omit()` over `.passthrough()`", which recommended the legacy method and read as a preference. The kept bullet names `z.looseObject()` beside it.

### Cut without a source or a bug class

- Cut "do not export the runtime Schema if only the inferred Type is required by consumers" as an export taste naming no failure.

### Merged or reworded

- Merged "do not manually declare interfaces that duplicate Zod schemas" into the `z.infer` bullet.
- Narrowed "restrict `z.coerce` to I/O boundaries" to string input and named the conversion, which is why `z.coerce.boolean()` reads `"false"` as `true`.
