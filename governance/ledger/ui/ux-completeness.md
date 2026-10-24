---
title: UX completeness rule ledger
description: Sources for governance/rules/ui/ux-completeness.md, one row per bullet
---

# UX completeness rule ledger

The field is interaction design, and the authorities are the Nielsen Norman Group's research articles, WCAG 2.2 for timing, MDN for the `title` attribute and CSS truncation, and web.dev for layout shift.

## Feedback

| Bullet                                 | Source                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Read                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Confirm success and failure            | [Visibility of system status](https://www.nngroup.com/articles/visibility-system-status/): "Whenever users interact with a system, they need to know whether the interaction was successful"                                                                                                                                                                                                                                                                        | 2026-10-18           |
| Auto-dismiss only a redundant message  | [Understanding Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html): "If the user has no other means of discovering the same information (or performing the same function), then each message would need to meet this success criterion"                                                                                                                                                                                          | 2026-10-18, WCAG 2.2 |
| Timed messages pause and take no focus | [Fluent 2, Toast usage](https://fluent2.microsoft.design/components/web/react/core/toast/usage): a toast with no action times out "after seven seconds", and mouse users "can pause the timer by hovering". [Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): status messages are presented "without receiving focus". The pause leaves the redundant-message bullet's rule for when a message may leave unchanged | 2026-10-23           |
| No optimistic status                   | House choice: a "connected" dot shown over unsaved edits reports a state the system has not reached, and the person leaves believing their change took                                                                                                                                                                                                                                                                                                              | 2026-10-18           |

## Empty states

| Bullet                         | Source                                                                                                                                                                                                                                               | Read       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Empty state with a next action | [Designing empty states](https://www.nngroup.com/articles/empty-state-interface-design/): designed empty states "Provide direct pathways for getting started with key tasks"                                                                         | 2026-10-18 |
| Distinguish new from filtered  | [Designing empty states](https://www.nngroup.com/articles/empty-state-interface-design/): after a filter returns nothing, people wonder "Did an error occur? Did I set the wrong filters or parameters?", and "Totally empty states cause confusion" | 2026-10-18 |

## Loading states

| Bullet                         | Source                                                                                                                                                                                                  | Read       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Indicator past one second      | [Progress indicators](https://www.nngroup.com/articles/progress-indicators/): "Use a progress indicator for any action that takes longer than about 1.0 second"                                         | 2026-10-18 |
| Mark stale content as updating | [Progress indicators](https://www.nngroup.com/articles/progress-indicators/): "Without any visual change from the system, most users will assume the action was not registered and they will try again" | 2026-10-18 |

## Destructive actions

| Bullet                                          | Source                                                                                                                                                                                                                                                                                                                                             | Read       |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Confirm unless undoable                         | [Confirmation dialogs](https://www.nngroup.com/articles/confirmation-dialog/): "consider a confirmation dialog before actions that cannot be undone", and "do try your best to offer undo"                                                                                                                                                         | 2026-10-18 |
| Cancelled edit restores, never discards unasked | [Primer, Edit pattern](https://primer.style/product/scenario-patterns/edit): "Put the content back to the value it had before the edit when someone cancels", and "Confirm before discarding an edit someone has put work into". The anti-pattern is to "Discard a half-written edit because someone pressed Escape or clicked outside the editor" | 2026-10-23 |

## Element states

| Bullet                                 | Source                                                                                                                                                                                                                                                                                                                                                                                      | Read                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Distinct interaction states            | [Visibility of system status](https://www.nngroup.com/articles/visibility-system-status/): "Did the system actually catch that button press", and an element with no pressed or hover response leaves the person unable to tell                                                                                                                                                             | 2026-10-18           |
| Say why a control is disabled          | [Cloudscape, Disabled and read-only states](https://cloudscape.design/patterns/general/disabled-and-read-only-states/): "Use disabled reasons where adequate context is not provided through disabled button or label text", and `aria-disabled="true"` is used "so that it will remain focusable"                                                                                          | 2026-10-23           |
| Declare `color-scheme`                 | [MDN, color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme): the user agent adapts "The default colors of scrollbars and other interaction UI" and "The default colors of form controls", and the page opts in by declaring it on the `:root` element                                                                                           | 2026-10-23           |
| Hover and focus content                | [Understanding Content on Hover or Focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html): additional content is "Dismissible" without moving hover or focus, "Hoverable" so the pointer can move over it, and "Persistent" until "the hover or focus trigger is removed, the user dismisses it, or its information is no longer valid"                         | 2026-10-23, WCAG 2.2 |
| No change of context on focus or input | [Understanding On Focus](https://www.w3.org/WAI/WCAG22/Understanding/on-focus.html): "When any user interface component receives focus, it does not initiate a change of context". [Understanding On Input](https://www.w3.org/WAI/WCAG22/Understanding/on-input.html): changing a setting does not cause one "unless the user has been advised of the behavior before using the component" | 2026-10-23, WCAG 2.2 |
| No intermediate flash                  | [Cumulative Layout Shift](https://web.dev/articles/cls): "Unexpected layout shifts can disrupt the user experience", caused by content "dynamically added to the page before existing content"                                                                                                                                                                                              | 2026-10-18           |

## Overflow

| Bullet                        | Source                                                                                                                                                                                                                                  | Read       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Ellipsis over overflow        | [text-overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/text-overflow): `text-overflow: ellipsis` with `overflow: hidden` and `white-space: nowrap` clips text at the box with a visible marker                                | 2026-10-18 |
| Never `title` alone           | [The title attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/title): "Use of the title attribute is highly problematic for" people using touch-only devices, keyboards, and assistive technology | 2026-10-18 |
| Focus rings clear of clipping | House choice: a ring cut off by a parent's `overflow` shows on the middle items of a list and vanishes on the first and last, so the focus indicator fails exactly where the list ends                                                  | 2026-10-18 |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Contradicted by the source

- Replaced the `title`-or-expand truncation bullet with the never-`title`-alone bullet, since MDN calls the attribute "highly problematic" for touch and keyboard users.
- Qualified "feedback must auto-dismiss after 2 to 3 seconds" against WCAG 2.2.1, since a message carrying the only copy of its information sets a time limit on reading it.
- Rewrote "do not show stale content while new content is loading", which offered keeping the previous content as its own alternative, to the marking bullet.

### Moved to a sibling rule

- Moved "confirmation UI must be dismissible via Escape" and "inline confirmation rows must be dismissible via Escape" to the Escape bullet in `keyboard.md`.
- Moved "status indicators must reset to a neutral state when their source input changes" to `forms.md`, which held the same bullet for derived values.
- Cut "confirmation labels and destructive buttons must have sufficient contrast", which `a11y.md` holds for every control.

### Cut without a source or a bug class

- Cut "disabled elements must use muted colors and `cursor: not-allowed`", a convention Claude already follows that no source sets.
- Cut "use CSS transitions or deferred rendering to prevent visible flicker", merged into the intermediate flash bullet as its remedy.

### Merged or reworded

- Merged the `## Inline confirmations`, `## Status indicators`, `## State transitions`, `## Interactive element states`, and `## Scroll and clipping` H2s into six, the merge the plan suggested.
- Merged "every list must handle the empty state" with "empty states must include a next action", and the two filter bullets into one.
- Merged "do not rely on a single state to communicate interactivity" into the distinct states bullet.
- Reworded "every async operation must show a loading indicator" to NN/g's one second threshold, since a shorter spinner distracts.
