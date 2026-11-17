# UX completeness standards

## Feedback

- Confirm every user-initiated mutation, such as a save, delete, or import, inline on success, and show an inline error when it fails.
- Auto-dismiss a success message only when its outcome stays visible elsewhere. Keep a message carrying the only copy of its information until dismissed (WCAG 2.2.1).
- Pause a timed message while it has pointer hover or keyboard focus, and take no focus for it. A person finishes reading it, and a status message never interrupts typing (WCAG 4.1.3).
- Show no optimistic status, such as a green dot or "connected", while unsaved edits are pending.

## Empty states

- Give every list, table, or collection an explicit empty state carrying a next action, such as a button or link.
- Write different copy for "nothing exists yet" and "nothing matches your filter", and give the filtered state a way to clear the filter.

## Loading states

- Show a progress indicator for any operation a person waits on for longer than about one second.
- Mark previous content as updating while new content loads, rather than showing it unmarked as current.
- Show a placeholder shaped like the content while a whole view or page loads, and keep a single module such as a card on the progress indicator.
- Show neither a placeholder nor an indicator for a load under about one second, since the flash of either costs more than the wait.

## State across a reload

- Hold the route, the selected tab, filters and sort, search text, pagination, and the selected item in the address, so a reload, a bookmark, and the back button reach the same view.
- Keep an unsent draft and panel sizes in browser storage, and restore them on reload. Leave a password or payment field out of the kept draft.
- Reset an open confirm or destructive dialog, a one-time message, hover and focus, an in-flight drag, and a selection whose item is gone, since restoring one repeats an act or points at nothing.

## Overflow

- Truncate long text in a constrained container with an ellipsis rather than letting it overflow.
- Expose truncated text through an expand control or full text on focus, never through a `title` tooltip alone.
- Keep interactive borders clear of a parent's `overflow` clipping, padding the edge items of a scrollable list.
