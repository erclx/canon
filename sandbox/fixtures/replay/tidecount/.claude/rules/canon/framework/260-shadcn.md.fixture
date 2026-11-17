---
description: Enforce shadcn/ui v4 component patterns, semantic tokens, and composition rules
paths:
  - '**/*.tsx'
  - '**/*.jsx'
---

# shadcn/ui standards

## Source files

- Do not edit component files installed by the shadcn CLI. Treat them as vendored.
- Check `components.json` for the install path.
- Extend behavior via wrapper components over modifying installed files.

## Component authoring

- Use `React.ComponentProps<typeof Primitive>` over `React.forwardRef`.
- Add `data-slot="component-name"` to every primitive root for Tailwind targeting.

## Tokens and styling

- Use semantic color tokens (`bg-background`, `text-foreground`, `border-border`) over hardcoded colors.
- Use `cn()` from `@/lib/utils` for all className merging and conditional classes.
- Do not override shadcn component internals with arbitrary classes.
- Extend via `className` prop only.

## Composition

- Compose shadcn primitives as documented.
- Do not destructure or restructure internal component trees.
- Use `asChild` prop with `<Slot>` for polymorphic rendering.
- Do not wrap primitives in extra DOM elements.
- Use `sonner` for toasts over the deprecated `toast` component.
