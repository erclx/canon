---
description: Routes code placement and shape decisions to the skills that carry them, and library calls to the official docs
---

# Code standards

## Placement

- Load the `canon:codebase-layout` skill before placing a new file, and report it rather than proceeding silently when it does not resolve.

## Shape

- Load the `canon:code-craft` skill before deciding the shape of a new function, class, or module, and report it rather than proceeding silently when it does not resolve.

## Libraries

- Before calling a library API the codebase does not already use, fetch the official docs for the installed version and match the call to them, since recall of an API goes stale.
