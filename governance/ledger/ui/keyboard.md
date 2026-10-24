---
title: Keyboard rule ledger
description: Sources for governance/rules/ui/keyboard.md, one row per bullet
---

# Keyboard rule ledger

The field is web accessibility, and the authorities are the W3C, through WCAG 2.2 and the ARIA Authoring Practices Guide, MDN for CSS behavior, and the platform guidelines from Apple and Android for native targets. Every bullet here was split from `a11y.md`.

## Focus styles

| Bullet                                   | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Read                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| One project focus ring                   | House choice: per-component focus styles drift apart, and `canon inventory` reports the ring by computed style, so a one-off treatment shows as its own row                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 2026-10-18           |
| No outline removal without a replacement | [outline](https://developer.mozilla.org/en-US/docs/Web/CSS/outline): "Assigning outline a value of 0 or none will remove the browser's default focus style. If an element can be interacted with it must have a visible focus indicator."                                                                                                                                                                                                                                                                                                                                                                                                                      | 2026-10-18           |
| 3:1 ring in every theme                  | [Understanding Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): visual information needed to identify a state needs "a contrast ratio of at least 3:1 against adjacent color(s)"                                                                                                                                                                                                                                                                                                                                                                                                                                        | 2026-10-18, WCAG 2.2 |
| Ring kept whole                          | [CSS UI 4](https://www.w3.org/TR/css-ui-4/): "By default, the outline is drawn starting just outside the border edge", and negative `outline-offset` values "must cause the outline to shrink into the border box". [MDN overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow): with `hidden`, "Overflow content is clipped at the element's padding box". [Understanding Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html), Level AAA, asks for an indicator "at least as large as the area of a 2 CSS pixel thick perimeter". A partial clip passes AA, so the bullet rests on the project's own ring rule | 2026-10-23           |

## Keyboard operation

| Bullet                     | Source                                                                                                                                                                                                                                                                        | Read                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Escape closes              | [Dialog (modal) pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): "Escape : Closes the dialog", and the [combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) gives Escape the same job for a popup                                          | 2026-10-18, APG      |
| No bare character shortcut | [Understanding Character Key Shortcuts](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html): a character-only shortcut needs a way to "Turn off", to "Remap", or to be "Active only on focus"                                                           | 2026-10-18, WCAG 2.2 |
| No keyboard trap           | [Understanding No Keyboard Trap](https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html): "If keyboard focus can be moved to a component of the page using a keyboard interface, then focus can be moved away from that component using only a keyboard interface" | 2026-10-23, WCAG 2.2 |

## Composite widgets

| Bullet                                  | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Read            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| One item in the tab sequence            | [Developing a keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/): "the tab sequence should include only one focusable element of a composite UI component", managed by "a roving tabindex" or "the aria-activedescendant property"                                                                                                                                                                                                         | 2026-10-18, APG |
| Combobox keys                           | [Combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/): "Down Arrow : If the popup is available, moves focus into the popup", Enter accepts the focused option, and "Escape : Dismisses the popup if it is visible"                                                                                                                                                                                                                                        | 2026-10-18, APG |
| Spinbutton keys and the pattern pointer | [Spinbutton pattern](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/): Up Arrow "Increases the value", Down Arrow decreases it, Home and End set the limits where they exist, and Page Up is optional, "by a larger step than Up Arrow". The pointer to other patterns rests on the [APG patterns index](https://www.w3.org/WAI/ARIA/apg/patterns/), "How to build accessibility semantics into web patterns and widgets", and a bullet per pattern is declined below | 2026-10-23, APG |

## Focus management

| Bullet                       | Source                                                                                                                                                                                                                                 | Read                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Focus into a dialog and back | [Dialog (modal) pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): "When a dialog opens, focus moves to an element inside the dialog", and "When a dialog closes, focus returns to the element that invoked the dialog" | 2026-10-18, APG      |
| Focus never covered          | [Understanding Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html): "the component is not entirely hidden due to author-created content"                                        | 2026-10-18, WCAG 2.2 |

## Declined

Every bullet the split removed or reshaped, grouped by why.

### Left to axe or to a person

- Declined a bullet per APG pattern. One pointer to the pattern page costs a line, and a bullet per pattern costs context on every component edit.

### Browser defaults

- Cut the Tab, Enter, and Space bullets of the old keyboard model. A native element does each by default, and `a11y.md` already sends a session to the native element.

### Rewritten to what the source says

- Replaced "do not introduce non-standard key bindings" with the character key bullet. No reviewer can check "non-standard", and the criterion names the binding that breaks.
- Narrowed "move focus into any overlay, popover, or dialog on open" to a dialog. The APG moves focus into a modal dialog, and a non-modal popover such as a tooltip leaves focus on its trigger.

### Cut without a source or a bug class

- Cut "never move focus on hover", a convention Claude already follows that no cited page takes a side on.

### Merged or reworded

- Merged "arrow keys navigate within composite widgets" into the roving `tabindex` bullet, which names the arrow keys.
- Merged "Escape cancels in-progress edits" into the Escape bullet, and took in the inline confirmation case from the `ux-completeness.md` rewrite so the Escape behavior has one copy.
- Reworded the combobox bullet to the pattern's own keys, dropping "typing filters", which the APG leaves to each autocomplete behavior.
