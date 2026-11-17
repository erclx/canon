---
description: Enforce safe concurrency and async operation patterns
---

# Concurrency standards

## Async lifecycle

- Make async operations cancellable. Clean up on scope exit or caller cancellation.
- Coordinate dependent async operations explicitly. Document execution order.
- Set explicit timeouts on all external async operations.
- Do not fire-and-forget async operations without cleanup handlers.
- Batch independent async operations. Do not run them sequentially when parallelizable.

## Race conditions

- Do not ignore race conditions in concurrent flows.
- Protect shared mutable state with locks, queues, or single-writer patterns.

## Failure handling

- Handle partial failures in batched operations independently. Do not fail the entire batch for a single error.
