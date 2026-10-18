---
description: Enforce casing for interface text in markup, MDX, and content modules, where copy lives in a content folder
paths:
  - '**/*.tsx'
  - '**/*.jsx'
  - '**/*.astro'
  - '**/*.html'
  - '**/*.mdx'
  - '**/content/**/*.ts'
---

# Interface casing standards

## Sentence case

- Use sentence case for rendered headings, labels, nav items, tab titles, and dialog titles, since title case on every heading reads as a template default.
- Keep the original casing of a proper noun or product name, such as `GitHub`, `macOS`, or `TypeScript`.

## Uppercase labels

- Keep small uppercase labels above headings to `ceil(sections / 3)`, the first screen counting as one. Delete the extra labels, since position already names a section.

## Where it applies

- Apply the same casing to interface copy kept outside the globs, such as a locale file, which this rule never fires on.

## Overriding

- Depart from sentence case only where the case needs it, such as an acronym, a brand mark, or a set-in-caps identity the design chose on purpose.
