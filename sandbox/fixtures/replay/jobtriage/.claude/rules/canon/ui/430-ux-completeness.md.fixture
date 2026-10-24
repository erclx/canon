---
description: UX completeness checklist for interactive components and views
paths:
  - '**/*.tsx'
  - '**/*.jsx'
  - '**/*.astro'
  - '**/*.html'
  - '**/*.css'
---

# UX completeness standards

## Mutation feedback

- Every user-initiated mutation (save, delete, sync, import, export) must show inline feedback on success.
- Feedback must be transient: auto-dismiss after 2-3 seconds without requiring user action.
- Show inline error feedback when a mutation fails. Do not fail silently.

## Empty states

- Every list, table, or collection view must handle the empty state explicitly.
- Empty states must include a next action: a button, link, or instruction that tells the user what to do.
- Distinguish between "nothing exists yet" (onboarding) and "nothing matches your filter" (recovery). Use different copy for each.
- Filter-driven empty states must include a way to clear the filter (link or button).

## Loading states

- Every async operation visible to the user must show a loading indicator (spinner, skeleton, or disabled state).
- Do not show stale content while new content is loading. Either show a loading state or keep the previous content with a progress indicator.

## Destructive actions

- Destructive actions (delete, disconnect, discard) must require confirmation before executing.
- Confirmation UI must be dismissible via Escape in addition to a cancel button.

## Inline confirmations

- All inline confirmation rows (delete, discard, cancel) must be dismissible via Escape.
- Confirmation labels and destructive buttons must have sufficient contrast in both light and dark modes.

## Status indicators

- Status indicators (dots, badges, connection status) must reset to a neutral state when their source input changes.
- Do not show optimistic status (green dot, "connected") while unsaved edits are pending.

## State transitions

- Do not flash intermediate states during transitions (e.g., white flash on theme load, layout jump before data arrives).
- Use CSS transitions or deferred rendering to prevent visible flicker between states.

## Interactive element states

- All interactive elements must visually respond to hover, active, focus, and disabled states.
- Disabled elements must use reduced opacity or muted colors and `cursor: not-allowed`.
- Do not rely on a single state (e.g., focus only) to communicate interactivity.

## Overflow and truncation

- Long text in constrained containers must truncate with ellipsis, not overflow or wrap unexpectedly.
- Truncated text must be accessible via `title` attribute or expandable interaction.

## Scroll and clipping

- Focus rings and interactive borders must not be clipped by parent `overflow: hidden` or `overflow: auto` containers.
- Add padding or adjust overflow to prevent clipping on edge items in scrollable lists.
