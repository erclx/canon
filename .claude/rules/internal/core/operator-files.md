---
description: Preserve the properties of a file the operator owns when rewriting it
paths:
  - 'src/**/*.ts'
---

# Operator file standards

## Preserving the destination

- Read a destination's mode before writing and restore it after. Writing through `mktemp` then `mv` replaces the file and gives it the temp file's mode.
- Copy a config onto an existing path with the destination's mode, never the source's.
- Read an existing config's indent width and write it back, so only the changed keys appear in the diff.
