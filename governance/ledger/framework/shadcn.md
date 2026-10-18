---
title: shadcn/ui rule ledger
description: Sources for governance/rules/framework/shadcn.md, one row per bullet
---

# shadcn/ui rule ledger

The field is front-end engineering, and the authority is the shadcn/ui documentation and changelog at ui.shadcn.com. The rewrite reads the July 2026 changelog, which made Base UI the default primitive library.

## Source files

| Bullet                       | Source                                                                                                                                                                                                            | Read       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Edit installed code in place | [Introduction](https://ui.shadcn.com/docs): "This is not a component library. It is how you build your component library", and "Modify any part of a component to fit your design and functionality requirements" | 2026-10-18 |
| Diff before overwrite        | [CLI](https://ui.shadcn.com/docs/cli): `add --overwrite` will "overwrite existing files", and `--diff` will "show diff for a file"                                                                                | 2026-10-18 |
| Import through the aliases   | [components.json](https://ui.shadcn.com/docs/components-json): "The CLI uses these values to place generated components in the correct location and rewrite imports"                                              | 2026-10-18 |

## Component authoring

| Bullet                    | Source                                                                                                                | Read                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `ComponentProps` typing   | [Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4): "Replace React.forwardRef<...> with React.ComponentProps<...>" | 2026-10-18, React 19       |
| `data-slot` on primitives | [Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4): "Every primitive now has a data-slot attribute for styling"    | 2026-10-18, Tailwind CSS 4 |

## Tokens and styling

| Bullet          | Source                                                                                                                                                                                      | Read       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Semantic tokens | [Theming](https://ui.shadcn.com/docs/theming): "We use semantic background and foreground pairs", mapped "into utilities like bg-background, text-foreground, border-border, and ring-ring" | 2026-10-18 |
| `cn()` merging  | [Manual installation](https://ui.shadcn.com/docs/installation/manual): re-export `cn` "from lib/utils.ts so your own code has a single place to import helpers from"                        | 2026-10-18 |

## Composition

| Bullet                       | Source                                                                                                                                                                                          | Read       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `render` or `asChild`        | [Base UI as the default](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default): "New projects now use Base UI by default", "Radix is not being deprecated", and "asChild is now render" | 2026-10-18 |
| `buttonVariants()` for links | [Button](https://ui.shadcn.com/docs/components/button): "The Base UI Button component always applies role="button", which overrides the semantic link role on a elements"                       | 2026-10-18 |
| `sonner` for toasts          | [Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4): "We're deprecating the toast component in favor of sonner"                                                                               | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the docs

- Replaced "do not edit installed component files, treat them as vendored". The [introduction](https://ui.shadcn.com/docs) says "The top layer of your component code is open for modification".
- Cut "extend behavior via wrapper components over modifying installed files" for the same reason.
- Cut "do not override component internals with arbitrary classes, extend via `className` only". Editing the variants in the owned file is what the docs describe.
- Reworded "use `asChild` with `<Slot>` for polymorphic rendering", since Base UI projects use `render` and the scoped and open searches agreed on that split.

### Cut without a source or a bug class

- Cut "compose shadcn primitives as documented", which no reviewer can check against a line of code.
- Cut "do not destructure or restructure internal component trees" for the same reason.
- Cut "do not wrap primitives in extra DOM elements" as a style call with no page read taking a side.

### Merged or reworded

- Reworded "check `components.json` for the install path" to the aliases bullet, which names what the file controls.
- Reworded "use `cn()` for all className merging" to the override it guarantees.
