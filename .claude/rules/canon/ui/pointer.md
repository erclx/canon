---
description: Pointer actions, gestures, outside-press dismissal, and target size for rendered UI
paths:
  - '**/*.tsx'
  - '**/*.jsx'
  - '**/*.astro'
  - '**/*.html'
  - '**/*.css'
---

# Pointer standards

## Pointer actions

- Dismiss a popover or menu on a press outside it and when focus leaves it, as well as on Escape.
- Run a pointer action on release rather than press, so a person can slide off the target to abort it (WCAG 2.5.2).
- Give a path-based or multipoint gesture, such as a swipe or pinch, a single-pointer alternative with no path (WCAG 2.5.1).
- Give every author-defined drag a single-pointer alternative and a keyboard path, such as move buttons or arrow-key reordering (WCAG 2.5.7).

## Pointer targets

- Size a web pointer target at least 24 by 24 CSS pixels, or space it so a 24 pixel circle centered on it touches no other target (WCAG 2.5.8).
- Size a native touch target at the platform figure, 44 points on iOS and 48 dp on Android, and never swap the web and native figures.
