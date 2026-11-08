---
title: Motion reference ledger
description: Sources for claude/skills/ui-craft/references/motion.md, one row per bullet
---

# Motion reference ledger

The fields are web accessibility, interaction design, and web performance. The W3C, through WCAG 2.2 and the ARIA Authoring Practices Guide, and MDN for the media feature back the accessibility rows. Shneiderman's direct manipulation paper and Material's motion system back reader-paced motion, and web.dev backs the held size.

## Moving content

| Bullet                          | Source                                                                                                                                                                                                                                                                          | Read                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Pause past five seconds         | [Understanding Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html): moving information that "starts automatically", "lasts more than five seconds", and sits beside other content needs "a mechanism for the user to pause , stop, or hide it" | 2026-10-18, WCAG 2.2 |
| Halt rotation on focus or hover | [Carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/): a rotating carousel "Stops rotating when keyboard focus enters the carousel" and "whenever the mouse is hovering over the carousel"                                                                     | 2026-10-18, APG      |
| Three flashes                   | [Understanding Three Flashes or Below Threshold](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html): pages "do not contain anything that flashes more than three times in any one second period"                                                | 2026-10-18, WCAG 2.2 |

## Motion the reader drives

| Bullet              | Source                                                                                                                                                                                                                                                                                                           | Read                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Follow the input    | [Shneiderman, Direct Manipulation, IEEE Computer 1983](https://www.cs.umd.edu/~ben/papers/Shneiderman1983Direct.pdf): direct manipulation rests on "Rapid, incremental, reversible operations whose impact on the object of interest is immediately visible."                                                    | 2026-11-08, IEEE Computer 1983 |
| Swap at a threshold | [Material Components Android, Motion](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md): the fade through variant will "sequentially fade out and in the outgoing and incoming views, respectively, in order to minimize the visual overlap of these views" | 2026-11-08, Material           |
| Hold the outer size | [Cumulative Layout Shift](https://web.dev/articles/cls): to animate without shifting layout, "Instead of changing the height and width properties, use transform: scale()"                                                                                                                                       | 2026-11-08, web.dev            |

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
