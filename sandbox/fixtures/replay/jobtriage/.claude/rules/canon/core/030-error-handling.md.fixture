---
description: Enforce consistent error handling patterns
---

# Error handling standards

## Boundary validation

- Validate inputs at system boundaries. Reject invalid data immediately.
- Do not use exceptions for control flow.

## Error classification

- Distinguish expected failures (validation, not found) from unexpected failures (null reference, network timeout).
- Return structured error types for recoverable failures.
- Propagate exceptions for programmer errors.

## Error propagation

- Handle errors at the layer with enough context to respond meaningfully.
- Do not catch and rethrow without adding value.
- Do not silently ignore errors.

## Error reporting

- Include actionable context in error messages.
- Never expose internal implementation details in error messages.

## Retry behavior

- Retry only idempotent operations with bounded attempts and backoff.
