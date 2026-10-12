---
description: Moving content controls and the reduced-motion preference for rendered UI
paths:
  - '**/*.tsx'
  - '**/*.jsx'
  - '**/*.astro'
  - '**/*.html'
  - '**/*.css'
---

# Motion standards

## Moving content

- Give any content that moves, blinks, or scrolls automatically for more than five seconds a control to pause, stop, or hide it (WCAG Pause, Stop, Hide, 2.2.2).
- Halt an auto-advancing carousel or ticker while it holds keyboard focus or pointer hover.
- Do not flash content more than three times in any one second.

## Reduced motion

- Honor `prefers-reduced-motion: reduce` for every animation and transition that conveys no state. Remove it or replace it with an instant change.
- Keep essential state changes visible under reduced motion, using a fade or a static indicator instead of movement.
- Do not start video or animated backgrounds on their own when the preference is set.
