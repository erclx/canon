---
title: Tailwind CSS rule ledger
description: Sources for governance/rules/framework/tailwind.md, one row per bullet
---

# Tailwind CSS rule ledger

The field is front-end engineering, and the authority is the Tailwind CSS documentation at tailwindcss.com, read for Tailwind CSS 4.

## Theme variables

| Bullet                          | Source                                                                                                                                                                                                                  | Read                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `@theme` or `:root`             | [Theme variables](https://tailwindcss.com/docs/theme): "use :root for defining regular CSS variables that shouldn't have corresponding utility classes", and theme variables must be "defined top-level and not nested" | 2026-10-18, Tailwind CSS 4 |
| Custom dark variant for a class | [Dark mode](https://tailwindcss.com/docs/dark-mode): "By default this uses the prefers-color-scheme CSS media feature", and a selector-driven theme overrides it with `@custom-variant dark`                            | 2026-10-18, Tailwind CSS 4 |

## Layout and spacing

| Bullet                     | Source                                                                                                                                                                            | Read                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `flex` or `grid` for flow  | House choice: a floated or absolutely positioned element leaves the document flow, so its siblings overlap or collapse once the viewport width changes                            | 2026-10-18                 |
| `gap-*` over child margins | House choice: a margin on each child leaves a stray edge when the last item wraps or a conditional item is hidden, which `gap` never does                                         | 2026-10-18                 |
| `size-*` for equal sides   | [Width](https://tailwindcss.com/docs/width): "Use utilities like size-px, size-4, and size-full to set both the width and height of an element at the same time"                  | 2026-10-18, Tailwind CSS 4 |
| Mobile first               | [Responsive design](https://tailwindcss.com/docs/responsive-design): "unprefixed utilities take effect on all screen sizes", and "Don't think of sm: as meaning on small screens" | 2026-10-18, Tailwind CSS 4 |

## Class application

| Bullet                          | Source                                                                                                                                                                                                                                           | Read                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| Complete class names            | [Detecting classes in source files](https://tailwindcss.com/docs/detecting-classes-in-source-files): Tailwind "has no way of understanding string concatenation or interpolation", so "map props to complete class names"                        | 2026-10-18, Tailwind CSS 4 |
| No conflicting utilities        | [Styling with utility classes](https://tailwindcss.com/docs/styling-with-utility-classes): "you should just never add two conflicting classes to the same element"                                                                               | 2026-10-18, Tailwind CSS 4 |
| `!` only as a last resort       | [Styling with utility classes](https://tailwindcss.com/docs/styling-with-utility-classes): "When you really need to force a specific utility class to take effect and have no other means of managing the specificity, you can add ! to the end" | 2026-10-18, Tailwind CSS 4 |
| Arbitrary values for one-offs   | [Styling with utility classes](https://tailwindcss.com/docs/styling-with-utility-classes): "When you need to use a one-off value outside of your theme, use the special square bracket syntax"                                                   | 2026-10-18, Tailwind CSS 4 |
| Inline style for dynamic values | [Styling with utility classes](https://tailwindcss.com/docs/styling-with-utility-classes): inline styles are useful "when a value is coming from a dynamic source like a database or API", and for "setting CSS variables"                       | 2026-10-18, Tailwind CSS 4 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the docs

- Reworded "do not use the `!` important modifier", since the [utility classes](https://tailwindcss.com/docs/styling-with-utility-classes) page documents the trailing `!` for the case nothing else resolves.

### Cut without a source or a bug class

- Cut "always pair light and dark utilities explicitly". No page read requires it, and a color token redefined for dark mode switches with no `dark:` pair at all.
- Cut "define dark mode color overrides in `.dark { }` at root level over `@layer base`", which no Tailwind page read takes a side on.
- Cut "use `cn()` from `@/lib/utils` for all conditional class application" as the import convention the shadcn rule already owns. The kept conflict bullet names `cn()` for the override case.

### Merged or reworded

- Merged "use `flex` and `grid` for all layouts" and "never use floats or absolute positioning for flow" into one bullet naming the bug class.
- Reworded "use `size-*` over `w-* h-*`" to the matching pair it replaces.
- Reworded "mobile-first, default styles apply to mobile" to the `sm:` misreading the responsive page warns about.
- Added "write every class name in full", the footgun the source detection page names and the old rule missed.
