---
description: Focus styles, keyboard operation, composite widgets, and focus management for rendered UI
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
- Keep the focus ring whole. Where an ancestor's `overflow` would clip it, inset it with a negative `outline-offset` or pad the edge items of the list.

## Keyboard operation

- Close a dialog, popover, menu, or inline confirmation on Escape, and cancel an in-progress edit the same way.
- Never trap keyboard focus. A person who tabs into a component can leave it by keyboard alone, and a modal dialog leaves on Escape (WCAG 2.1.2).
- Bind no single printable character as a shortcut unless a person can turn it off or remap it, or it fires only while its control has focus (WCAG 2.1.4).

## Composite widgets

- Keep one item of a composite widget in the tab sequence, and move between its items with the arrow keys through roving `tabindex` or `aria-activedescendant`.
- Open a combobox popup on Down Arrow, accept the focused option on Enter, and close the popup on Escape without changing the value.
- Give a custom number input the spinbutton keys, Up and Down to step and Home and End for the limits. Take the keys of any other custom widget from its ARIA Authoring Practices Guide pattern.

## Focus management

- Move focus into a dialog when it opens, and return it to the element that opened it when it closes.
- Never let a sticky header, footer, or overlay fully cover the focused control. Scroll it clear of them (WCAG 2.4.11).
