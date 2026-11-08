# Motion standards

## Moving content

- Give any content that moves, blinks, or scrolls automatically for more than five seconds a control to pause, stop, or hide it (WCAG 2.2.2).
- Halt an auto-advancing carousel or ticker while it holds keyboard focus or pointer hover.
- Never flash content more than three times in any one second (WCAG 2.3.1).

## Motion the reader drives

- When the reader sets the pace, as with a scroll, a drag, or a swipe, move by the input rather than a timer, so stopping halfway leaves the motion halfway and reversing the input reverses it.
- Never blend two texts mid-transition. Swap them at a threshold so every moment shows one readable state, with no blank frame between them.
- Keep a component's outer size fixed while it animates, or swaps instantly under reduced motion, letting its contents give and take room inside it, so the page around it never moves.

## Reduced motion

- Honor `prefers-reduced-motion: reduce` for every animation and transition that conveys no state. Remove it or replace it with an instant change.
- Keep essential state changes visible under reduced motion, using a fade or a static indicator instead of movement.
- Start no video or animated background on its own when the preference is set.
