---
title: Motion rule ledger
description: Sources for governance/rules/ui/motion.md, one row per bullet
---

# Motion rule ledger

The field is web accessibility, and the authorities are the W3C, through WCAG 2.2 and the ARIA Authoring Practices Guide, and MDN for the media feature.

## Moving content

| Bullet                          | Source                                                                                                                                                                                                                                                                          | Read                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Pause past five seconds         | [Understanding Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html): moving information that "starts automatically", "lasts more than five seconds", and sits beside other content needs "a mechanism for the user to pause , stop, or hide it" | 2026-10-18, WCAG 2.2 |
| Halt rotation on focus or hover | [Carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/): a rotating carousel "Stops rotating when keyboard focus enters the carousel" and "whenever the mouse is hovering over the carousel"                                                                     | 2026-10-18, APG      |
| Three flashes                   | [Understanding Three Flashes or Below Threshold](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html): pages "do not contain anything that flashes more than three times in any one second period"                                                | 2026-10-18, WCAG 2.2 |

## Reduced motion

| Bullet                           | Source                                                                                                                                                                                                                                                         | Read                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Honor the preference             | [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion): it detects a setting "to minimize the amount of non-essential motion", for an interface "that removes, reduces, or replaces motion-based animations" | 2026-10-18           |
| Essential changes stay visible   | [Understanding Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html): motion can be disabled "unless the animation is essential to the functionality or the information being conveyed"                   | 2026-10-18, WCAG 2.2 |
| No autoplay under the preference | [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion): the setting asks the browser for an interface that "removes, reduces, or replaces motion-based animations", and a self-starting video is one         | 2026-10-18           |

## Declined

Every bullet the rewrite removed or reshaped, grouped by why.

### Merged or reworded

- Added the criterion number to the three flashes bullet, so every WCAG bullet in the rule names the criterion it rests on.
- Reworded "do not" bans to "never" and "start no" forms, with no change of meaning.
