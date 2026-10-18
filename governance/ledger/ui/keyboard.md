---
title: Keyboard rule ledger
description: Sources for governance/rules/ui/keyboard.md, one row per bullet
---

# Keyboard rule ledger

The field is web accessibility, and the authorities are the W3C, through WCAG 2.2 and the ARIA Authoring Practices Guide, MDN for CSS behavior, and the platform guidelines from Apple and Android for native targets. Every bullet here was split from `a11y.md`.

## Focus styles

| Bullet                                   | Source                                                                                                                                                                                                                                    | Read                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| One project focus ring                   | House choice: per-component focus styles drift apart, and `canon inventory` reports the ring by computed style, so a one-off treatment shows as its own row                                                                               | 2026-10-18           |
| No outline removal without a replacement | [outline](https://developer.mozilla.org/en-US/docs/Web/CSS/outline): "Assigning outline a value of 0 or none will remove the browser's default focus style. If an element can be interacted with it must have a visible focus indicator." | 2026-10-18           |
| 3:1 ring in every theme                  | [Understanding Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html): visual information needed to identify a state needs "a contrast ratio of at least 3:1 against adjacent color(s)"                   | 2026-10-18, WCAG 2.2 |

## Keyboard operation

| Bullet                         | Source                                                                                                                                                                                                                               | Read                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| Escape closes                  | [Dialog (modal) pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): "Escape : Closes the dialog", and the [combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) gives Escape the same job for a popup | 2026-10-18, APG      |
| No bare character shortcut     | [Understanding Character Key Shortcuts](https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html): a character-only shortcut needs a way to "Turn off", to "Remap", or to be "Active only on focus"                  | 2026-10-18, WCAG 2.2 |
| Drag has a single-pointer path | [Understanding Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html): "For any action that involves dragging, provide a simple pointer alternative"                                               | 2026-10-18, WCAG 2.2 |

## Composite widgets

| Bullet                       | Source                                                                                                                                                                                                                                                             | Read            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| One item in the tab sequence | [Developing a keyboard interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/): "the tab sequence should include only one focusable element of a composite UI component", managed by "a roving tabindex" or "the aria-activedescendant property" | 2026-10-18, APG |
| Combobox keys                | [Combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/): "Down Arrow : If the popup is available, moves focus into the popup", Enter accepts the focused option, and "Escape : Dismisses the popup if it is visible"                                | 2026-10-18, APG |

## Focus management

| Bullet                       | Source                                                                                                                                                                                                                                 | Read                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Focus into a dialog and back | [Dialog (modal) pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): "When a dialog opens, focus moves to an element inside the dialog", and "When a dialog closes, focus returns to the element that invoked the dialog" | 2026-10-18, APG      |
| Focus never covered          | [Understanding Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html): "the component is not entirely hidden due to author-created content"                                        | 2026-10-18, WCAG 2.2 |

## Pointer targets

| Bullet              | Source                                                                                                                                                                                                                                                                                                                              | Read                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 24 by 24 on the web | [Understanding Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): "at least 24 by 24 CSS pixels", except where "a 24 CSS pixel diameter circle is centered on the bounding box of each" and "the circles do not intersect"                                                               | 2026-10-18, WCAG 2.2 |
| Native figures      | [Apple accessibility guidelines](https://developer.apple.com/design/human-interface-guidelines/accessibility): a default "44x44 pt" control size on iOS and iPadOS, and [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps): "a focusable area, or touch target size , of at least 48dpx48dp" | 2026-10-18           |

## Declined

Every bullet the split removed or reshaped, grouped by why.

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
