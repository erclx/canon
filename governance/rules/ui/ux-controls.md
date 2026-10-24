---
description: Destructive actions, edit cancel, and element states for interactive controls
paths:
  - '**/*.tsx'
  - '**/*.jsx'
  - '**/*.astro'
  - '**/*.html'
  - '**/*.css'
---

# UX controls standards

## Destructive actions

- Confirm a destructive action, such as a delete, disconnect, or discard, before it runs, unless it can be undone afterward.
- Restore the value from before an edit when the edit is cancelled. Never discard typed work on Escape or an outside click unasked, but confirm first when the person has typed something.

## Element states

- Give every interactive element distinct hover, active, focus, and disabled styles.
- Never flash an intermediate state, such as a light frame before a dark theme or a layout jump before data arrives. Reserve the space or settle it first.
- Say why a control is disabled, in text beside it or a tooltip, and keep it focusable through `aria-disabled` when the reason matters.
- Declare `color-scheme` on `:root` to match each theme, so scrollbars and form controls follow the theme instead of staying light.
- Keep content shown on hover or focus dismissible without moving the pointer, hoverable, and visible until the trigger leaves or the person dismisses it (WCAG 1.4.13).
- Change no context, such as navigating, submitting, or moving focus, when a control gains focus or changes value, unless the person was told first (WCAG 3.2.1, 3.2.2).
