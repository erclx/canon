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

- Use sentence case for all rendered interface text: headings, labels, nav items, tab titles, and dialog titles.
- Retain original casing for proper nouns and product names: `GitHub`, `macOS`, `TypeScript`.
- Treat title case on every heading as a template tell, since it reads as a default rather than a choice.

## Uppercase labels

- Keep small uppercase labels above headings to one per three sections, with the first screen counting as one. More than `ceil(sections / 3)` is too many, and the fix is usually to delete the label, since a section's position already says what it is.
- Treat the count as a judgment, since a glob cannot check it.

## Where it applies

- The rule covers markup, MDX, and content modules under a `content/` folder. Copy kept elsewhere, such as a locale file, is not reached, so apply the same casing there without the rule firing.

## Overriding

- Depart from sentence case where the case needs it, such as an acronym, a brand mark, or a set-in-caps identity the design chose on purpose.
