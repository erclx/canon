---
description: Route edits under canon/context/ to the context-fold skill for the entry shape, and keep each entry conforming to the work in its domain
paths:
  - 'canon/context/**'
---

# Context standards

## Context entries

- Load the `canon:context-fold` skill before a hand edit under `canon/context/`, since it carries the entry shape and the content rules for a domain entry.
- Report it rather than proceeding silently when `canon:context-fold` does not resolve.
- Before non-trivial work in a domain, read its `canon/context/<domain>/` entry. Use `canon/context/index.md` to find it.
- Leave the entry conforming when work in its domain changes what it describes.
