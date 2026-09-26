---
description: Code placement, dependency, error, and naming choices a model does not make by default
---

# Code standards

## Placement

- Load the `canon:codebase-layout` skill before placing a new file, and report it rather than proceeding silently when it does not resolve.
- Prioritize native platform capabilities over third-party libraries.
- Ensure data and configuration reside in designated Single Source of Truth locations.

## Errors

- Return structured error types for recoverable failures.
- Never expose internal implementation details in error messages.

## Naming

- Prefix booleans with `is`, `has`, `should`, or `can`: `isLoading`, `hasAccess`.
- Prefix event handlers with `handle`: `handleClick`, `handleSubmit`.
