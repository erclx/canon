---
description: Enforce Go naming, error wrapping, context passing, and package boundaries
paths:
  - '**/*.go'
---

# Go standards

## Casing conventions

- Use `MixedCaps` for exported names and `mixedCaps` for unexported ones. Never use underscores in a Go identifier.
- Name packages with one short lowercase word. Do not use `util`, `common`, or `helpers` as a package name.
- Do not repeat the package name in an exported identifier (`user.New`, not `user.NewUser`).
- Keep initialisms in one case (`userID`, `HTTPClient`), never `userId` or `HttpClient`.

## Errors

- Return an error as the last result value.
- Wrap an error with `fmt.Errorf("...: %w", err)` when adding context.
- Match an error with `errors.Is` or `errors.As`. Never compare `err.Error()` strings.
- Never discard an error with `_`.
- Do not `panic` for a failure a caller can expect. Reserve it for a broken invariant.

## Context

- Pass `context.Context` as the first parameter, named `ctx`.
- Never store a `context.Context` in a struct field.
- Do not pass a `nil` context. Use `context.TODO()` where none is available yet.

## Interfaces

- Declare an interface in the package that consumes it, not the one that implements it.
- Keep an interface to the methods its consumer calls.
- Accept interfaces and return concrete types.

## Packages

- Place code no other module may import under `internal/`.
- Do not perform side effects in `init`. Wire dependencies explicitly from `main`.
- Do not hold mutable state in a package-level variable.
