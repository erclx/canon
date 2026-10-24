---
title: UX controls reference ledger
description: Sources for claude/skills/ui-craft/references/controls.md, one row per bullet
---

# UX controls reference ledger

The field is interaction design, and the authorities are the Nielsen Norman Group, WCAG 2.2, Primer, Cloudscape, MDN, and web.dev. These bullets were split from `ux-completeness.md`.

## Destructive actions

| Bullet                                          | Source                                                                                                                                                                                                                                                                                                                                             | Read       |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Confirm unless undoable                         | [Confirmation dialogs](https://www.nngroup.com/articles/confirmation-dialog/): "consider a confirmation dialog before actions that cannot be undone", and "do try your best to offer undo"                                                                                                                                                         | 2026-10-18 |
| Cancelled edit restores, never discards unasked | [Primer, Edit pattern](https://primer.style/product/scenario-patterns/edit): "Put the content back to the value it had before the edit when someone cancels", and "Confirm before discarding an edit someone has put work into". The anti-pattern is to "Discard a half-written edit because someone pressed Escape or clicked outside the editor" | 2026-10-23 |

## Element states

| Bullet                        | Source                                                                                                                                                                                                                                                                                             | Read       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Distinct interaction states   | [Visibility of system status](https://www.nngroup.com/articles/visibility-system-status/): "Did the system actually catch that button press", and an element with no pressed or hover response leaves the person unable to tell                                                                    | 2026-10-18 |
| Say why a control is disabled | [Cloudscape, Disabled and read-only states](https://cloudscape.design/patterns/general/disabled-and-read-only-states/): "Use disabled reasons where adequate context is not provided through disabled button or label text", and `aria-disabled="true"` is used "so that it will remain focusable" | 2026-10-23 |
| Declare `color-scheme`        | [MDN, color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme): the user agent adapts "The default colors of scrollbars and other interaction UI" and "The default colors of form controls", and the page opts in by declaring it on the `:root` element  | 2026-10-23 |
| No intermediate flash         | [Cumulative Layout Shift](https://web.dev/articles/cls): "Unexpected layout shifts can disrupt the user experience", caused by content "dynamically added to the page before existing content"                                                                                                     | 2026-10-18 |

## Hover and focus effects

| Bullet                                 | Source                                                                                                                                                                                                                                                                                                                                                                                      | Read                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Hover and focus content                | [Understanding Content on Hover or Focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html): additional content is "Dismissible" without moving hover or focus, "Hoverable" so the pointer can move over it, and "Persistent" until "the hover or focus trigger is removed, the user dismisses it, or its information is no longer valid"                         | 2026-10-23, WCAG 2.2 |
| No change of context on focus or input | [Understanding On Focus](https://www.w3.org/WAI/WCAG22/Understanding/on-focus.html): "When any user interface component receives focus, it does not initiate a change of context". [Understanding On Input](https://www.w3.org/WAI/WCAG22/Understanding/on-input.html): changing a setting does not cause one "unless the user has been advised of the behavior before using the component" | 2026-10-23, WCAG 2.2 |
