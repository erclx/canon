# Motion standards

## Moving content

- Give any content that moves, blinks, or scrolls automatically for more than five seconds a control to pause, stop, or hide it (WCAG 2.2.2).
- Halt an auto-advancing carousel or ticker while it holds keyboard focus or pointer hover.
- Never flash content more than three times in any one second (WCAG 2.3.1).

## Reduced motion

- Honor `prefers-reduced-motion: reduce` for every animation and transition that conveys no state. Remove it or replace it with an instant change.
- Keep essential state changes visible under reduced motion, using a fade or a static indicator instead of movement.
- Start no video or animated background on its own when the preference is set.
