---
description: Enforce shadcn/ui component ownership, typed primitives, semantic tokens, and composition props
paths:
  - '**/*.tsx'
  - '**/*.jsx'
---

# shadcn/ui standards

## Source files

- Edit an installed component in place when the design needs it, since the code is the project's own.
- Read `shadcn add --diff` before running `--overwrite` on a component, since overwriting discards local edits.
- Import components and `cn` through the aliases in `components.json`, which the CLI uses to place files and rewrite imports.

## Component authoring

- Type a component's props as `React.ComponentProps<typeof Primitive>`, not `React.forwardRef`.
- Add `data-slot="<name>"` to the root of a new primitive, matching the installed components.

## Tokens and styling

- Use semantic tokens such as `bg-background`, `text-foreground`, and `border-border` over hardcoded colors.
- Merge classes with `cn()` from `@/lib/utils`, so a caller's `className` overrides the component's defaults.

## Composition

- Compose through `render` in a Base UI project, the default for new ones, and through `asChild` in a Radix one.
- Style a link as a button with `buttonVariants()`, never a Base UI `Button` rendering an `<a>`, which forces `role="button"`.
- Use `sonner` for toasts, since the `toast` component is deprecated.
