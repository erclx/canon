---
description: Enforce Tailwind CSS v4 utility patterns, theme tokens, dark mode, and custom styles
paths:
  - '**/*.tsx'
  - '**/*.jsx'
  - '**/*.html'
  - '**/*.css'
---

# Tailwind CSS v4 standards

## Theme variables

- Use `@theme` for design tokens that generate utility classes.
- Use `:root` for plain CSS variables with no utility counterpart.
- Define dark mode color overrides in `.dark { }` at root level over `@layer base`.
- Always pair light and dark utilities explicitly: `bg-white dark:bg-gray-900`.

## Layout and spacing

- Use `flex` and `grid` for all layouts.
- Never use floats or absolute positioning for flow.
- Use `gap-*` for sibling spacing over margins.
- Use `size-*` over `w-* h-*` for equal dimensions.
- Mobile-first: default styles apply to mobile. Use `sm:` and up to override.

## Class application

- Use `cn()` from `@/lib/utils` for all conditional class application.
- Do not use the `!` important modifier.
- Do not use inline `style` props for static styling. Use arbitrary values (`bg-[#316ff6]`) instead.
- Use inline styles only for dynamic values from JS/API or to set CSS variables for utility consumption.
