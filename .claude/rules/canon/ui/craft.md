---
description: Route edits to a rendered surface to the ui-craft skill for how it behaves and to the design-taste skill for how it looks
paths:
  - '**/*.tsx'
  - '**/*.jsx'
  - '**/*.vue'
  - '**/*.svelte'
  - '**/*.astro'
  - '**/*.html'
  - '**/*.mdx'
  - '**/*.css'
  - '**/*.scss'
  - '**/content/**/*.ts'
  - 'canon/DESIGN.md'
---

# UI craft standards

## Authority

- Load the `canon:ui-craft` skill for how a surface behaves and the `canon:design-taste` skill for how it looks. Each is the single source for its half.
- Report it rather than proceeding silently when either skill does not resolve. Both ship with the plugin and this rule ships with the CLI, so governance alone carries neither.
