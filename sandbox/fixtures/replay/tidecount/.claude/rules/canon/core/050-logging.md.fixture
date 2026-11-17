---
description: Enforce structured logging and observability
---

# Logging standards

## Log coverage

- Log state transitions at boundaries (requests received, external calls made, errors encountered).
- Do not log in performance-critical code paths.

## Log format

- Use structured formats with consistent metadata (timestamp, severity, correlation ID).
- Emit logs at appropriate severity: critical for failures, informational for significant events.

## Log safety

- Do not log credentials, tokens, or personally identifiable information.
- Log observable behavior, not implementation details.
