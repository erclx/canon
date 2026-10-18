---
description: Enforce zod schema validation and type inference
paths:
  - '**/*.ts'
  - '**/*.tsx'
---

# Zod validation standards

## Type inference

- Derive a schema's type with `z.infer<typeof Schema>`, never a hand-written interface that duplicates the schema.

## Boundary validation

- Parse untrusted input with `z.strictObject()` so an unknown key fails, never with a method the Zod 4 changelog marks legacy.
- Narrow a schema with `.pick()` or `.omit()`, never by passing unknown keys through with `z.looseObject()`.
- Call `.parse()` where a failure should throw, and `.safeParse()` where the caller recovers, such as a form.
- Restrict `z.coerce` to string input at an I/O boundary such as URL params, since it converts with `String()` or `Boolean()`.

## Schema safety

- Use `z.unknown()` for an input of unknown shape, never `z.any()`, which infers `any` and switches off checking downstream.
