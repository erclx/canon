---
description: Focus styles, keyboard operation, focus management, and pointer targets for rendered UI
paths:
  - '**/*.tsx'
  - '**/*.jsx'
  - '**/*.astro'
  - '**/*.html'
  - '**/*.css'
---

# Keyboard and focus standards

## Focus styles

- Style focus through the project's one focus ring rather than a per-component focus style.
- Never set `outline: none` or `outline-none` without a replacement focus indicator in the same rule.
- Give the focus ring 3:1 contrast against its background in every theme the project ships.

## Keyboard operation

- Close a dialog, popover, menu, or inline confirmation on Escape, and cancel an in-progress edit the same way.
- Bind no single printable character as a shortcut unless a person can turn it off or remap it, or it fires only while its control has focus (WCAG 2.1.4).
- Give every author-defined drag a single-pointer alternative and a keyboard path, such as move buttons or arrow-key reordering (WCAG 2.5.7).

## Composite widgets

- Keep one item of a composite widget in the tab sequence, and move between its items with the arrow keys through roving `tabindex` or `aria-activedescendant`.
- Open a combobox popup on Down Arrow, accept the focused option on Enter, and close the popup on Escape without changing the value.

## Focus management

- Move focus into a dialog when it opens, and return it to the element that opened it when it closes.
- Never let a sticky header, footer, or overlay fully cover the focused control. Scroll it clear of them (WCAG 2.4.11).

## Pointer targets

- Size a web pointer target at least 24 by 24 CSS pixels, or space it so a 24 pixel circle centered on it touches no other target (WCAG 2.5.8).
- Size a native touch target at the platform figure, 44 points on iOS and 48 dp on Android, and never swap the web and native figures.
