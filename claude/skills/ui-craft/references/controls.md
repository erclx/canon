# UX controls standards

## Destructive actions

- Confirm a destructive action, such as a delete, disconnect, or discard, before it runs, unless it can be undone afterward.
- Restore the value from before an edit when the edit is cancelled. Never discard typed work on Escape or an outside click unasked, but confirm first when the person has typed something.

## Modals

- Open a modal only for a task that needs the person's full attention or an answer before they continue, and use inline content for anything they can ignore.
- Never open a modal from inside a modal, and close the first before showing the second. A confirm or alert may sit over one, one at a time.
- Open a surface one control revealed beside it on wide screens, as a popover aimed at it and covering it as little as it can. A phone takes a sheet, and a confirm or alert takes the viewport placement.

## Navigation

- Use a tab bar to move among a page's sections, and never to run an action, since an action takes a button. Tabs that switch a view inside one section are not covered.
- Label every tab with text, beside or beneath its icon.
- Keep every tab shown and enabled when its section is empty, and say why the section has nothing.

## Permissions

- Ask for a browser permission, such as location, notifications, or the camera, when the person first uses the feature that needs it. Ask at load only when the page cannot work at all without the grant.

## Element states

- Give every interactive element distinct hover, active, focus, and disabled styles.
- Never flash an intermediate state, such as a light frame before a dark theme or a layout jump before data arrives. Reserve the space or settle it first.
- Say why a control is disabled, in text beside it or a tooltip, and keep it focusable through `aria-disabled` when the reason matters.
- Declare `color-scheme` on `:root` to match each theme, so scrollbars and form controls follow the theme instead of staying light.

## Signifiers

- Give nothing a control's look, such as a button fill or a tab underline, unless it acts, since the look promises a response.
- Keep the default cursor on decorative chrome, such as a mock tab bar, a status pill, or an address bar.

## Hover and focus effects

- Keep content shown on hover or focus dismissible without moving the pointer, hoverable, and visible until the trigger leaves or the person dismisses it (WCAG 1.4.13).
- Change no context, such as navigating, submitting, or moving focus, when a control gains focus or changes value, unless the person was told first (WCAG 3.2.1, 3.2.2).
- Put hover styles behind `@media (hover: hover)`, since a touch screen keeps the last tapped element in hover.
