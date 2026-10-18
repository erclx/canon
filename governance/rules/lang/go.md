---
description: Enforce Go error wrapping, context passing, interface placement, and package boundaries
paths:
  - '**/*.go'
---

# Go standards

## Errors

- Wrap an error with `fmt.Errorf("...: %w", err)` when adding context.
- Match an error with `errors.Is` or `errors.As`. Never compare with `==` or on `err.Error()` strings, which miss a wrapped error.
- Never discard an error with `_`. Handle it, return it, or panic on a broken invariant.
- Return an `error` for a failure a caller can expect. Reserve `panic` for a broken invariant.

## Context

- Pass `context.Context` as the first parameter, named `ctx`.
- Never store a `context.Context` in a struct field. Pass it to each function that needs it.
- Do not pass a `nil` context. Use `context.TODO()` where none is available yet.

## Interfaces

- Declare an interface in the package that consumes it, holding only the methods that consumer calls.
- Accept interfaces and return concrete types.

## Packages

- Place code no other module may import under `internal/`.
- Do not perform side effects in `init`. Wire dependencies explicitly from `main`.
- Do not hold mutable state in a package-level variable. Pass it through a struct the caller owns.
