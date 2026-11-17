---
description: Enforce zod schema validation and type inference
paths:
  - '**/*.ts'
  - '**/*.tsx'
---

# Zod validation standards

## Type inference

- Use `z.infer<typeof Schema>` to generate TypeScript types (Single Source of Truth).
- Do not manually declare interfaces that duplicate Zod schemas.
- Do not export the runtime Schema if only the inferred Type is required by consumers.

## Boundary validation

- Use `.strict()` for untrusted external API boundaries to prevent data pollution.
- Use `.parse()` for blocking validation (env vars) and `.safeParse()` for recoverable flows (forms).
- Restrict `z.coerce` to I/O boundaries (e.g., URL params). Never use it for internal data flow.

## Schema safety

- Use `z.unknown()` for truly ambiguous inputs instead of `z.any()`.
- Prefer `.strict()` at boundaries or explicit `.pick()`/`.omit()` over `.passthrough()`.
