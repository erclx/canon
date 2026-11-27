---
description: Route edits under canon/context/ to the context-sync skill for the entry shape
paths:
  - 'canon/context/**'
---

# Context standards

## Context entries

- Load the `canon:context-sync` skill before a hand edit under `canon/context/`, since it carries the entry shape and the content rules for a domain entry.
- Report it rather than proceeding silently when `canon:context-sync` does not resolve.
