---
description: Enforce Tailwind CSS v4 theme variables, dark mode, layout spacing, and class application
paths:
  - '**/*.tsx'
  - '**/*.jsx'
  - '**/*.html'
  - '**/*.css'
---

# Tailwind CSS v4 standards

## Theme variables

- Define a token in a top-level `@theme` block when it needs a utility class, and in `:root` when it does not.
- Add `@custom-variant dark (&:where(.dark, .dark *))` when a `.dark` class toggles dark mode, since `dark:` follows `prefers-color-scheme` by default.

## Layout and spacing

- Lay out flow content with `flex` or `grid`, never `float` or `absolute`, which pulls an element out of flow so it overlaps at other widths.
- Space siblings with `gap-*` on the parent over margins on the children, which leave a stray edge when an item wraps or hides.
- Use `size-*` over a matching `w-*` and `h-*` pair.
- Write unprefixed utilities for mobile and add `sm:` and up for wider screens, since `sm:` means that breakpoint and above.

## Class application

- Write every class name in full, mapping a prop to a complete class, since Tailwind cannot detect a class built by concatenation.
- Never put two conflicting utilities on one element. Merge a caller's override through `cn()`, which drops the losing class.
- Add the trailing `!` modifier only when no other way to manage specificity exists.
- Use an arbitrary value such as `bg-[#316ff6]` for a static one-off, never an inline `style`.
- Keep inline `style` for a value from a dynamic source, or to set a CSS variable a utility reads.
